/**
 * ============================================================
 * CKLA Skills Tracking — Apps Script System
 * File: FormIntegration.gs
 * Purpose: Phase 2 — Google Form-to-Sheet mapping with
 *          automated response insertion for all unit types.
 * ============================================================
 */

// ===================== FORM CONFIGURATION ====================

/**
 * Build a unified Google Form for a specific unit tab.
 * Creates a form with sections matching the assessment structure,
 * sets up validation, and links it to the active spreadsheet.
 *
 * @param {string} tabName - The unit tab to create a form for
 * @returns {Object} - { success, formUrl, formId } or { success, error }
 */
function createAssessmentForm(tabName) {
  const ss = SpreadsheetApp.getActiveSpreadsheet();
  const sheet = ss.getSheetByName(tabName);

  if (!sheet) {
    return { success: false, error: 'Tab not found: ' + tabName };
  }

  const structure = getUnitStructure(tabName);
  if (structure.error) {
    return { success: false, error: structure.error };
  }

  // Create the form
  const form = FormApp.create('CKLA Assessment — ' + tabName);
  form.setDescription(
    'Score entry form for ' + tabName + '.\n' +
    'Scores are automatically imported into the CKLA Skills Tracking spreadsheet.'
  );
  form.setCollectEmail(true);
  form.setAllowResponseEdits(true);
  form.setLimitOneResponsePerUser(false);

  // Add student selection field
  const studentItem = form.addTextItem();
  studentItem.setTitle('Student Name (Last, First)')
    .setRequired(true)
    .setHelpText('Enter the student name exactly as it appears in the roster.');

  // Add teacher selection field
  const teacherItem = form.addTextItem();
  teacherItem.setTitle('Teacher')
    .setRequired(true)
    .setHelpText('Enter your name as it appears in the Meta Data tab.');

  // Add score fields grouped by section
  structure.sections.forEach(function(section) {
    form.addSectionHeaderItem()
      .setTitle(section.name)
      .setHelpText(section.questions.length + ' items in this section');

    section.questions.forEach(function(q) {
      var item = form.addTextItem();
      item.setTitle(q.name)
        .setHelpText('Max points: ' + q.maxPoints + ' | Column: ' + q.col);

      // Add numeric validation
      var validation = FormApp.createTextValidation()
        .setHelpText('Enter a number between 0 and ' + q.maxPoints)
        .requireNumberBetween(0, q.maxPoints)
        .build();
      item.setValidation(validation);
    });
  });

  // Store form–tab mapping in script properties
  var props = PropertiesService.getScriptProperties();
  var mappings = JSON.parse(props.getProperty('FORM_TAB_MAPPINGS') || '{}');
  mappings[form.getId()] = {
    tabName: tabName,
    formUrl: form.getEditUrl(),
    publishedUrl: form.getPublishedUrl(),
    createdAt: new Date().toISOString()
  };
  props.setProperty('FORM_TAB_MAPPINGS', JSON.stringify(mappings));

  // Install form submit trigger
  ScriptApp.newTrigger('onFormSubmit')
    .forForm(form)
    .onFormSubmit()
    .create();

  return {
    success: true,
    formId: form.getId(),
    formUrl: form.getPublishedUrl(),
    editUrl: form.getEditUrl(),
    message: 'Form created for ' + tabName + ' with ' +
             structure.totalQuestions + ' score fields.'
  };
}


// ===================== FORM RESPONSE HANDLER =================

/**
 * Trigger handler: processes a form submission and writes
 * scores to the correct cells in the mapped unit tab.
 *
 * Installed automatically by createAssessmentForm().
 *
 * @param {Object} e - Form submit event object
 */
function onFormSubmit(e) {
  try {
    var formId = e.source.getId();
    var props = PropertiesService.getScriptProperties();
    var mappings = JSON.parse(props.getProperty('FORM_TAB_MAPPINGS') || '{}');
    var mapping = mappings[formId];

    if (!mapping) {
      console.log('No mapping found for form: ' + formId);
      return;
    }

    var tabName = mapping.tabName;
    var responses = e.response.getItemResponses();

    // Extract student name (first text item after headers)
    var studentName = '';
    var teacher = '';
    var scores = {};

    var structure = getUnitStructure(tabName);
    if (structure.error) {
      logFormError_(tabName, 'Structure error: ' + structure.error);
      return;
    }

    // Build a map of question names to column numbers
    var questionColMap = {};
    structure.sections.forEach(function(section) {
      section.questions.forEach(function(q) {
        questionColMap[q.name] = q;
      });
    });

    // Parse form responses
    responses.forEach(function(itemResponse) {
      var title = itemResponse.getItem().getTitle();
      var value = itemResponse.getResponse();

      if (title === 'Student Name (Last, First)') {
        studentName = String(value).trim();
      } else if (title === 'Teacher') {
        teacher = String(value).trim();
      } else if (questionColMap[title]) {
        var q = questionColMap[title];
        var numVal = Number(value);
        if (!isNaN(numVal) && numVal >= 0 && numVal <= q.maxPoints) {
          scores[q.col] = numVal;
        }
      }
    });

    if (!studentName) {
      logFormError_(tabName, 'Missing student name in form response');
      return;
    }

    // Write scores using the existing submitScores function
    var result = submitScores(tabName, studentName, scores);

    if (!result.success) {
      logFormError_(tabName, 'Submit failed for ' + studentName + ': ' + result.error);
    }

  } catch (err) {
    console.log('Form submit error: ' + err.message);
  }
}


// ===================== FORM MANAGEMENT =======================

/**
 * List all assessment forms that have been created and linked.
 *
 * @returns {Array} - Array of { tabName, formUrl, formId, createdAt }
 */
function listAssessmentForms() {
  var props = PropertiesService.getScriptProperties();
  var mappings = JSON.parse(props.getProperty('FORM_TAB_MAPPINGS') || '{}');

  return Object.keys(mappings).map(function(formId) {
    var m = mappings[formId];
    return {
      formId: formId,
      tabName: m.tabName,
      formUrl: m.publishedUrl,
      editUrl: m.formUrl,
      createdAt: m.createdAt
    };
  });
}


/**
 * Remove a form mapping (does not delete the Google Form itself).
 *
 * @param {string} formId - The Google Form ID to unlink
 * @returns {Object} - { success, message }
 */
function unlinkAssessmentForm(formId) {
  var props = PropertiesService.getScriptProperties();
  var mappings = JSON.parse(props.getProperty('FORM_TAB_MAPPINGS') || '{}');

  if (!mappings[formId]) {
    return { success: false, error: 'Form not found: ' + formId };
  }

  var tabName = mappings[formId].tabName;
  delete mappings[formId];
  props.setProperty('FORM_TAB_MAPPINGS', JSON.stringify(mappings));

  // Remove associated triggers
  var triggers = ScriptApp.getProjectTriggers();
  triggers.forEach(function(trigger) {
    if (trigger.getHandlerFunction() === 'onFormSubmit') {
      try {
        var source = trigger.getTriggerSourceId();
        if (source === formId) {
          ScriptApp.deleteTrigger(trigger);
        }
      } catch (e) {
        // Trigger source may not be accessible
      }
    }
  });

  return {
    success: true,
    message: 'Unlinked form for ' + tabName
  };
}


/**
 * Show the form management dialog. Lists existing forms and
 * allows creating new ones or unlinking existing ones.
 */
function showFormManagerDialog() {
  var forms = listAssessmentForms();
  var gradeMap = getUnitTabs();

  var html = '<div style="font-family:Google Sans,sans-serif;padding:16px">' +
    '<h3 style="color:#1a73e8;margin-bottom:12px">Assessment Form Manager</h3>';

  // Existing forms
  if (forms.length > 0) {
    html += '<h4 style="margin:12px 0 6px;font-size:13px">Linked Forms</h4>';
    html += '<table style="width:100%;border-collapse:collapse;font-size:12px">' +
      '<tr style="background:#e8f0fe"><th style="padding:6px;text-align:left">Unit</th>' +
      '<th style="padding:6px">Actions</th></tr>';

    forms.forEach(function(f) {
      html += '<tr><td style="padding:6px;border-bottom:1px solid #eee">' + f.tabName + '</td>' +
        '<td style="padding:6px;border-bottom:1px solid #eee;text-align:center">' +
        '<a href="' + f.formUrl + '" target="_blank" style="color:#1a73e8">Open</a> | ' +
        '<a href="#" onclick="unlinkForm(\'' + f.formId + '\')" style="color:#d93025">Unlink</a>' +
        '</td></tr>';
    });
    html += '</table>';
  } else {
    html += '<p style="font-size:12px;color:#5f6368">No assessment forms have been created yet.</p>';
  }

  // Create new form
  html += '<h4 style="margin:16px 0 6px;font-size:13px">Create New Form</h4>' +
    '<select id="newFormTab" style="width:100%;padding:8px;margin-bottom:8px;' +
    'border:1px solid #dadce0;border-radius:4px">' +
    '<option value="">Select a unit tab...</option>';

  Object.keys(gradeMap).forEach(function(grade) {
    gradeMap[grade].tabs.forEach(function(tab) {
      html += '<option value="' + tab + '">' + tab + '</option>';
    });
  });

  html += '</select>' +
    '<button onclick="createForm()" style="width:100%;padding:8px;background:#1a73e8;' +
    'color:white;border:none;border-radius:4px;cursor:pointer">Create Form</button>' +
    '<div id="formResult" style="margin-top:8px;font-size:12px"></div>';

  html += '<script>' +
    'function createForm(){' +
    'var tab=document.getElementById("newFormTab").value;' +
    'if(!tab){alert("Select a unit tab first");return;}' +
    'document.getElementById("formResult").textContent="Creating form...";' +
    'google.script.run.withSuccessHandler(function(r){' +
    'if(r.success){document.getElementById("formResult").innerHTML=' +
    '"<span style=\\"color:#137333\\">✓ "+r.message+"</span><br>' +
    '<a href=\\""+r.formUrl+"\\" target=\\"_blank\\">Open form</a>";}' +
    'else{document.getElementById("formResult").innerHTML=' +
    '"<span style=\\"color:#d93025\\">✗ "+r.error+"</span>";}' +
    '}).createAssessmentForm(tab);}' +
    'function unlinkForm(id){' +
    'if(!confirm("Unlink this form?"))return;' +
    'google.script.run.withSuccessHandler(function(r){' +
    'if(r.success)location.reload();' +
    'else alert(r.error);}).unlinkAssessmentForm(id);}' +
    '</script></div>';

  var output = HtmlService.createHtmlOutput(html)
    .setWidth(500)
    .setHeight(500);
  SpreadsheetApp.getUi().showModalDialog(output, 'Form Manager');
}


// ===================== INTERNAL HELPERS ======================

/**
 * Log a form processing error to the Submission Log sheet.
 * @param {string} tabName
 * @param {string} errorMsg
 */
function logFormError_(tabName, errorMsg) {
  try {
    var ss = SpreadsheetApp.getActiveSpreadsheet();
    var logSheet = ss.getSheetByName('Submission Log');
    if (!logSheet) return;

    logSheet.appendRow([
      new Date(),
      'FORM_ERROR',
      tabName,
      errorMsg,
      0
    ]);
  } catch (e) {
    console.log('Log error: ' + e.message);
  }
}
