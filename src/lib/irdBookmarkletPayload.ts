/**
 * Unminified, readable IRD RAMIS Bookmarklet Payload Builder.
 *
 * Generates the self-contained JavaScript payload injected via a `javascript:`
 * bookmarklet URI. Designed to run 100% offline inside the target page with
 * zero external network requests (CSP-safe) and zero `innerHTML` usage
 * (Trusted-Types-safe).
 *
 * Supports BOTH:
 *  1. Direct Cage fields (`MainReturnForm`, `Schedule8Form`, `StatementForm` flags)
 *  2. Repeating Kendo Grid rows (`Schedule1Form`–`Schedule4Form`, `Schedule7Form`,
 *     and `StatementForm` assets & liabilities) — all in one click.
 */

export interface IrdFieldMapping {
  /** Key in the embedded JSON payload (or in a grid row object) */
  key: string;
  /** Human-readable label shown in the floating toast if unmatched */
  label: string;
  /** CSS selector on the target IRD form (e.g. '#DeclarationTax_Rtn_Cage10') */
  selector: string;
  /** Optional explicit type hint */
  type?: 'number' | 'text' | 'select' | 'checkbox' | 'radio' | 'date';
  /** Optional selector to wait for via MutationObserver before filling */
  waitFor?: string;
  /** Timeout in ms when waiting for a dependent/async element (default: 3000) */
  waitTimeoutMs?: number;
}

export interface IrdGridMapping {
  /** Key in the embedded JSON payload containing an array of row objects */
  rowsKey: string;
  /** Human-readable section name shown in toast on error */
  label: string;
  /** Optional "Add Row" button to click before filling (used in StatementForm popups) */
  preClickSelector?: string;
  /** Button selector to submit/append the row into the Kendo Grid */
  addButtonSelector: string;
  /** Delay in ms after clicking Add before starting the next row (default: 350) */
  rowDelayMs?: number;
  /** Field mappings for each row object */
  fields: IrdFieldMapping[];
}

/**
 * Direct Cage mappings for `MainReturnForm`, `Schedule8Form`, and `StatementForm`.
 *
 * ============================================================================
 * WHERE TO PLUG IN / CUSTOMIZE DIRECT IRD FORM FIELD SELECTORS:
 * ============================================================================
 */
export const DEFAULT_RAMIS_FIELD_MAP: IrdFieldMapping[] = [
  {
    key: 'employmentIncome',
    label: 'Employment Income (Cage 10)',
    selector: '#DeclarationTax_Rtn_Cage10',
    type: 'number',
  },
  {
    key: 'businessIncome',
    label: 'Business Income (Cage 20)',
    selector: '#DeclarationTax_Rtn_Cage20',
    type: 'number',
  },
  {
    key: 'investmentIncome',
    label: 'Investment Income (Cage 30)',
    selector: '#DeclarationTax_Rtn_Cage30',
    type: 'number',
  },
  {
    key: 'otherIncome',
    label: 'Other Income (Cage 40)',
    selector: '#DeclarationTax_Rtn_Cage40',
    type: 'number',
  },
  {
    key: 'personalRelief',
    label: 'Personal Relief (Cage 100)',
    selector: '#Deduction_Rtn_Cage100',
    type: 'number',
  },
  {
    key: 'qualifyingPayments',
    label: 'Qualifying Payments / Reliefs (Cage 120)',
    selector: '#Deduction_Rtn_Cage120',
    type: 'number',
  },
  {
    key: 'hasLocalAssets',
    label: 'Statement: Local Assets Checkbox',
    selector: '#localAsset',
    type: 'checkbox',
  },
  {
    key: 'hasForeignAssets',
    label: 'Statement: Foreign Assets Checkbox',
    selector: '#foreignAsset',
    type: 'checkbox',
  },
];

/**
 * Repeating Kendo Grid mappings for Schedules 1–4, 7, and Statement of Assets.
 *
 * ============================================================================
 * WHERE TO PLUG IN / CUSTOMIZE SCHEDULE & STATEMENT GRID SELECTORS:
 * ============================================================================
 */
export const DEFAULT_RAMIS_GRID_MAP: IrdGridMapping[] = [
  {
    rowsKey: 'schedule1Rows',
    label: 'Schedule 1A (Employment Income)',
    addButtonSelector: '#btnS1AddA_2',
    fields: [
      { key: 'employerName', label: 'Employer/Company Name (Cage 102)', selector: '#Schedule1AModel_Sch1_Cage102', type: 'text' },
      { key: 'tin', label: 'TIN of Employer (Cage 103)', selector: '#Schedule1AModel_Sch1_Cage103', type: 'text' },
      { key: 'amount', label: 'Remuneration (Cage 104)', selector: '#Schedule1AModel_Sch1_Cage104', type: 'number' },
    ],
  },
  {
    rowsKey: 'schedule2Rows',
    label: 'Schedule 2A (Business Income)',
    addButtonSelector: '#btnS2AAdd_2',
    fields: [
      { key: 'businessName', label: 'Nature of Business (Cage 202)', selector: '#Schedule2AModel_Sch2_Cage202', type: 'text' },
      { key: 'amount', label: 'Income (Cage 203)', selector: '#Schedule2AModel_Sch2_Cage203', type: 'number' },
    ],
  },
  {
    rowsKey: 'schedule3Rows',
    label: 'Schedule 3A (Investment Income)',
    addButtonSelector: '#btnS301Add_2',
    fields: [
      { key: 'source', label: 'Type of Income (Cage 302)', selector: '#Schedule3AModel_Sch3_Cage302', type: 'text' },
      { key: 'amount', label: 'Income (Cage 303)', selector: '#Schedule3AModel_Sch3_Cage303', type: 'number' },
    ],
  },
  {
    rowsKey: 'schedule4Rows',
    label: 'Schedule 4 (Other Income)',
    addButtonSelector: '#btnS4Add',
    fields: [
      { key: 'description', label: 'Type of Income (Cage 401)', selector: '#Schedule4AModel_Sch4_Cage401', type: 'text' },
      { key: 'amount', label: 'Income (Cage 402)', selector: '#Schedule4AModel_Sch4_Cage402', type: 'number' },
    ],
  },
  {
    rowsKey: 'schedule7Rows',
    label: 'Schedule 7A (WHT / APIT Credits)',
    addButtonSelector: '#btnS7AAdd',
    fields: [
      { key: 'sourceType', label: 'Source/Type (Cage 701)', selector: '#Schedule7AModel_Sch7_Cage701', type: 'text' },
      { key: 'tin', label: 'TIN of Withholding Agent (Cage 702)', selector: '#Schedule7AModel_Sch7_Cage702', type: 'text' },
      { key: 'certificateNo', label: 'WHT Certificate No (Cage 703)', selector: '#Schedule7AModel_Sch7_Cage703', type: 'text' },
      { key: 'grossAmount', label: 'Amount Received (Cage 704)', selector: '#Schedule7AModel_Sch7_Cage704', type: 'number' },
      { key: 'paymentDate', label: 'Date of Payment (Cage 705)', selector: '#Schedule7AModel_Sch7_Cage705', type: 'date' },
      { key: 'taxDeducted', label: 'WHT Deducted (Cage 706)', selector: '#Schedule7AModel_Sch7_Cage706', type: 'number' },
      { key: 'name', label: 'Name of Withholding Agent (Cage 707)', selector: '#Schedule7AModel_Sch7_2526Cage707', type: 'text' },
    ],
  },
  {
    rowsKey: 'statement1ARows',
    label: 'Statement 1A (Immovable Properties)',
    preClickSelector: '#btnStatement1AAddRow',
    addButtonSelector: '#btnStatement1AAdd',
    fields: [
      { key: 'description', label: 'Situation of Property (Cage 1001)', selector: '#StatementPart1AModel_Sta_Cage1001', type: 'text' },
      { key: 'dateAcquired', label: 'Date of Acquisition (Cage 1002)', selector: '#StatementPart1AModel_Sta_Cage1002', type: 'date' },
      { key: 'cost', label: 'Cost (Cage 1003)', selector: '#StatementPart1AModel_Sta_Cage1003', type: 'number' },
      { key: 'marketValue', label: 'Market Value (Cage 1004)', selector: '#StatementPart1AModel_Sta_Cage1004', type: 'number' },
    ],
  },
  {
    rowsKey: 'statement1B1Rows',
    label: 'Statement 1B1 (Motor Vehicles)',
    preClickSelector: '#btnStatement1B1AddRow',
    addButtonSelector: '#btnStatement1B1Add',
    fields: [
      { key: 'description', label: 'Description (Cage 1005)', selector: '#StatementPart1B1Model_Sta_Cage1005', type: 'text' },
      { key: 'regNo', label: 'Registration No (Cage 1006)', selector: '#StatementPart1B1Model_Sta_Cage1006', type: 'text' },
      { key: 'dateAcquired', label: 'Date of Acquisition (Cage 1007)', selector: '#StatementPart1B1Model_Sta_Cage1007', type: 'date' },
      { key: 'cost', label: 'Cost / Market Value (Cage 1008)', selector: '#StatementPart1B1Model_Sta_Cage1008', type: 'number' },
    ],
  },
  {
    rowsKey: 'statement1B2Rows',
    label: 'Statement 1B2 (Bank Balances)',
    preClickSelector: '#btnStatement1B2AddRow',
    addButtonSelector: '#btnStatement1B2Add',
    fields: [
      { key: 'bankName', label: 'Bank / Institution (Cage 1009)', selector: '#StatementPart1B2Model_Sta_Cage1009', type: 'text' },
      { key: 'accountNo', label: 'Account No (Cage 1010)', selector: '#StatementPart1B2Model_Sta_Cage1010', type: 'text' },
      { key: 'amountInvested', label: 'Amount Invested (Cage 1011)', selector: '#StatementPart1B2Model_Sta_Cage1011', type: 'number' },
      { key: 'interest', label: 'Interest (Cage 1012)', selector: '#StatementPart1B2Model_Sta_Cage1012', type: 'number' },
      { key: 'balance', label: 'Balance (Cage 1013)', selector: '#StatementPart1B2Model_Sta_Cage1013', type: 'number' },
    ],
  },
  {
    rowsKey: 'statement1B3Rows',
    label: 'Statement 1B3 (Shares / Stocks)',
    preClickSelector: '#btnStatement1B3AddRow',
    addButtonSelector: '#btnStatement1B3Add',
    fields: [
      { key: 'company', label: 'Company / Institution (Cage 1014)', selector: '#StatementPart1B3Model_Sta_Cage1014', type: 'text' },
      { key: 'shares', label: 'No. of Shares/Stocks (Cage 1015)', selector: '#StatementPart1B3Model_Sta_Cage1015', type: 'text' },
      { key: 'dateAcquired', label: 'Date of Acquisition (Cage 1016)', selector: '#StatementPart1B3Model_Sta_Cage1016', type: 'date' },
      { key: 'cost', label: 'Cost of Acquisition (Cage 1017)', selector: '#StatementPart1B3Model_Sta_Cage1017', type: 'number' },
      { key: 'dividendIncome', label: 'Net Dividend Income (Cage 1018)', selector: '#StatementPart1B3Model_Sta_Cage1018', type: 'number' },
    ],
  },
  {
    rowsKey: 'statement1DRows',
    label: 'Statement 1D (Liabilities / Loans)',
    preClickSelector: '#btnStatement1DAddRow',
    addButtonSelector: '#btnStatement1DAdd',
    fields: [
      { key: 'security', label: 'Liability Description (Cage 1025)', selector: '#StatementPart1DModel_Sta_Cage1025', type: 'text' },
      { key: 'lender', label: 'Lender Name (Cage 1026)', selector: '#StatementPart1DModel_Sta_Cage1026', type: 'text' },
      { key: 'dateIncurred', label: 'Date of Commencement (Cage 1027)', selector: '#StatementPart1DModel_Sta_Cage1027', type: 'date' },
      { key: 'originalAmount', label: 'Original Amount (Cage 1028)', selector: '#StatementPart1DModel_Sta_Cage1028', type: 'number' },
      { key: 'amount', label: 'Closing Liability (Cage 1029)', selector: '#StatementPart1DModel_Sta_Cage1029', type: 'number' },
    ],
  },
];

/**
 * Returns the unminified, readable source code of the injected bookmarklet
 * payload with the UTF-8 Base64 data, direct field map, and grid map embedded.
 */
export function buildUnminifiedIrdPayloadScript(
  encodedPayloadBase64: string,
  fieldMap: IrdFieldMapping[] = DEFAULT_RAMIS_FIELD_MAP,
  gridMap: IrdGridMapping[] = DEFAULT_RAMIS_GRID_MAP
): string {
  const serializedMap = JSON.stringify(fieldMap, null, 2);
  const serializedGridMap = JSON.stringify(gridMap, null, 2);

  return `(async function () {
  'use strict';

  /* 1. Embedded UTF-8 Base64 Tax Payload (zero external network calls) */
  var ENCODED_DATA = ${JSON.stringify(encodedPayloadBase64)};

  /* 2. Direct Field Mapping: plug in or adjust IRD RAMIS Cage selectors here */
  var FIELD_MAP = ${serializedMap};

  /* 3. Repeating Kendo Grid Mapping: Schedules 1-4, 7 & Statement of Assets */
  var GRID_MAP = ${serializedGridMap};

  function sleep(ms) {
    return new Promise(function (resolve) { setTimeout(resolve, ms); });
  }

  /**
   * Safely decode a UTF-8 Base64 string into a JSON object.
   */
  function decodeUtf8Base64(b64) {
    var binary = atob(b64);
    var bytes = new Uint8Array(binary.length);
    for (var i = 0; i < binary.length; i++) {
      bytes[i] = binary.charCodeAt(i);
    }
    var jsonText = new TextDecoder('utf-8').decode(bytes);
    return JSON.parse(jsonText);
  }

  /**
   * Deep querySelector that searches the top-level document and any
   * accessible same-origin iframes (common in legacy government portals).
   */
  function querySelectorDeep(selector, root) {
    var doc = root || document;
    var found = doc.querySelector(selector);
    if (found) return found;

    var frames = doc.querySelectorAll('iframe, frame');
    for (var i = 0; i < frames.length; i++) {
      try {
        var frameDoc = frames[i].contentDocument || (frames[i].contentWindow && frames[i].contentWindow.document);
        if (frameDoc) {
          var inFrame = querySelectorDeep(selector, frameDoc);
          if (inFrame) return inFrame;
        }
      } catch (_crossOriginErr) {
        /* Cross-origin iframe cannot be accessed; skip safely */
      }
    }
    return null;
  }

  /**
   * Async helper using MutationObserver to wait for dynamically rendered
   * dependent fields (e.g. after a dropdown selection or popup open).
   */
  function waitForElement(selector, timeoutMs) {
    var limit = typeof timeoutMs === 'number' ? timeoutMs : 3000;
    var existing = querySelectorDeep(selector);
    if (existing) return Promise.resolve(existing);

    return new Promise(function (resolve) {
      var settled = false;
      var observer = new MutationObserver(function () {
        var el = querySelectorDeep(selector);
        if (el && !settled) {
          settled = true;
          observer.disconnect();
          clearTimeout(timer);
          resolve(el);
        }
      });

      observer.observe(document.documentElement || document.body, {
        childList: true,
        subtree: true
      });

      var timer = setTimeout(function () {
        if (!settled) {
          settled = true;
          observer.disconnect();
          resolve(querySelectorDeep(selector));
        }
      }, limit);
    });
  }

  function dispatchNativeEvents(el) {
    var eventNames = ['input', 'change', 'blur'];
    for (var i = 0; i < eventNames.length; i++) {
      el.dispatchEvent(new Event(eventNames[i], { bubbles: true, cancelable: true }));
    }
  }

  function setNativeValue(el, value) {
    var proto =
      el.tagName === 'SELECT'
        ? HTMLSelectElement.prototype
        : el.tagName === 'TEXTAREA'
          ? HTMLTextAreaElement.prototype
          : HTMLInputElement.prototype;

    var descriptor = Object.getOwnPropertyDescriptor(proto, 'value');
    if (descriptor && typeof descriptor.set === 'function') {
      descriptor.set.call(el, String(value));
    } else {
      el.value = String(value);
    }
    dispatchNativeEvents(el);
  }

  function highlightYellow(el) {
    if (!el) return;
    var target = (el.closest && el.closest('.k-widget')) || el;
    target.style.outline = '2px solid #eab308';
    target.style.backgroundColor = '#fef9c3';
  }

  function setFrameworkValue(el, rawValue, fieldType) {
    var tag = el.tagName.toUpperCase();
    var inputType = (el.getAttribute('type') || '').toLowerCase();
    var kendoRole = (el.getAttribute('data-role') || '').toLowerCase();
    var jq = window.jQuery || window.$;

    /* A. Telerik Kendo UI Widget Handling (RAMIS eservices.ird.gov.lk) */
    if (jq && kendoRole) {
      var $el = jq(el);
      if (kendoRole === 'numerictextbox') {
        var numWidget = $el.data('kendoNumericTextBox');
        if (numWidget) {
          numWidget.value(Number(rawValue));
          numWidget.trigger('change');
          dispatchNativeEvents(el);
          return true;
        }
      }
      if (kendoRole === 'dropdownlist') {
        var ddlWidget = $el.data('kendoDropDownList');
        if (ddlWidget) {
          var targetStr = String(rawValue).trim().toLowerCase();
          var dataSource = ddlWidget.dataSource && ddlWidget.dataSource.data ? ddlWidget.dataSource.data() : [];
          var matchedIdx = -1;
          for (var i = 0; i < dataSource.length; i++) {
            var item = dataSource[i];
            var textField = ddlWidget.options && ddlWidget.options.dataTextField ? item[ddlWidget.options.dataTextField] : '';
            var valField = ddlWidget.options && ddlWidget.options.dataValueField ? item[ddlWidget.options.dataValueField] : '';
            if (
              String(valField).trim().toLowerCase() === targetStr ||
              String(textField).trim().toLowerCase() === targetStr
            ) {
              matchedIdx = i;
              break;
            }
          }
          if (matchedIdx >= 0) {
            ddlWidget.select(matchedIdx);
          } else {
            ddlWidget.value(String(rawValue));
          }
          ddlWidget.trigger('change');
          dispatchNativeEvents(el);
          return matchedIdx >= 0 || Boolean(ddlWidget.value());
        }
      }
      if (kendoRole === 'datepicker') {
        var dpWidget = $el.data('kendoDatePicker');
        if (dpWidget) {
          dpWidget.value(rawValue);
          dpWidget.trigger('change');
          dispatchNativeEvents(el);
          return true;
        }
      }
    }

    /* B. Standard Checkbox & Radio Handling */
    if (inputType === 'checkbox' || fieldType === 'checkbox') {
      var desiredChecked = Boolean(rawValue);
      if (el.checked !== desiredChecked) {
        el.click();
      }
      dispatchNativeEvents(el);
      return true;
    }

    if (inputType === 'radio' || fieldType === 'radio') {
      var radioGroupName = el.getAttribute('name');
      if (radioGroupName) {
        var radios = document.querySelectorAll('input[type="radio"][name="' + radioGroupName + '"]');
        var targetVal = String(rawValue).trim().toLowerCase();
        for (var r = 0; r < radios.length; r++) {
          if (String(radios[r].value).trim().toLowerCase() === targetVal) {
            if (!radios[r].checked) radios[r].click();
            dispatchNativeEvents(radios[r]);
            return true;
          }
        }
        return false;
      }
      if (!el.checked) el.click();
      dispatchNativeEvents(el);
      return true;
    }

    /* C. Standard <select> Dropdown (match by value or visible option text) */
    if (tag === 'SELECT' || fieldType === 'select') {
      var desired = String(rawValue).trim().toLowerCase();
      var options = el.options || [];
      var matchedValue = null;
      for (var o = 0; o < options.length; o++) {
        var optVal = String(options[o].value || '').trim().toLowerCase();
        var optText = String(options[o].textContent || '').trim().toLowerCase();
        if (optVal === desired || optText === desired) {
          matchedValue = options[o].value;
          break;
        }
      }
      if (matchedValue === null) {
        return false;
      }
      setNativeValue(el, matchedValue);
      return true;
    }

    /* D. Standard <input type="text|number|date"> or <textarea> */
    setNativeValue(el, rawValue);
    return true;
  }

  function showToast(summaryText, missingLabels) {
    var existingToast = document.getElementById('wg-ird-autofill-toast');
    if (existingToast && existingToast.parentNode) {
      existingToast.parentNode.removeChild(existingToast);
    }

    var toast = document.createElement('div');
    toast.id = 'wg-ird-autofill-toast';
    toast.style.position = 'fixed';
    toast.style.top = '16px';
    toast.style.right = '16px';
    toast.style.zIndex = '2147483647';
    toast.style.maxWidth = '360px';
    toast.style.padding = '12px 16px';
    toast.style.borderRadius = '8px';
    toast.style.backgroundColor = '#0f172a';
    toast.style.color = '#f8fafc';
    toast.style.fontFamily = 'system-ui, -apple-system, sans-serif';
    toast.style.fontSize = '13px';
    toast.style.lineHeight = '1.45';
    toast.style.boxShadow = '0 10px 25px rgba(0,0,0,0.25)';
    toast.style.border = missingLabels.length > 0 ? '2px solid #eab308' : '2px solid #22c55e';

    var headerRow = document.createElement('div');
    headerRow.style.display = 'flex';
    headerRow.style.justifyContent = 'space-between';
    headerRow.style.alignItems = 'center';
    headerRow.style.gap = '12px';

    var title = document.createElement('strong');
    title.textContent = summaryText;

    var closeBtn = document.createElement('button');
    closeBtn.type = 'button';
    closeBtn.textContent = '×';
    closeBtn.style.background = 'transparent';
    closeBtn.style.border = 'none';
    closeBtn.style.color = '#94a3b8';
    closeBtn.style.fontSize = '18px';
    closeBtn.style.cursor = 'pointer';
    closeBtn.style.lineHeight = '1';
    closeBtn.onclick = function () {
      if (toast.parentNode) toast.parentNode.removeChild(toast);
    };

    headerRow.appendChild(title);
    headerRow.appendChild(closeBtn);
    toast.appendChild(headerRow);

    if (missingLabels.length > 0) {
      var note = document.createElement('div');
      note.style.marginTop = '8px';
      note.style.color = '#fde047';
      note.style.fontSize = '12px';
      note.textContent = 'Check manually (' + missingLabels.length + '): ' + missingLabels.join(', ');
      toast.appendChild(note);
    }

    (document.body || document.documentElement).appendChild(toast);

    setTimeout(function () {
      if (toast.parentNode) toast.parentNode.removeChild(toast);
    }, 12000);
  }

  /* 4. Execute Auto-Fill (Direct Cages + Repeating Schedule/Statement Grids) */
  try {
    var payload = decodeUtf8Base64(ENCODED_DATA);
    var activeFields = [];
    for (var i = 0; i < FIELD_MAP.length; i++) {
      var entry = FIELD_MAP[i];
      if (payload[entry.key] !== undefined && payload[entry.key] !== null) {
        activeFields.push(entry);
      }
    }

    var filled = 0;
    var missing = [];

    for (var j = 0; j < activeFields.length; j++) {
      var field = activeFields[j];
      var value = payload[field.key];
      var el = field.waitFor
        ? await waitForElement(field.waitFor, field.waitTimeoutMs || 3000)
        : querySelectorDeep(field.selector);

      if (!el) {
        missing.push(field.label);
        continue;
      }

      if (setFrameworkValue(el, value, field.type)) {
        filled++;
      } else {
        highlightYellow(el);
        missing.push(field.label);
      }
    }

    /* Process Repeating Kendo Grids */
    var totalRows = 0;
    var filledRows = 0;

    for (var g = 0; g < GRID_MAP.length; g++) {
      var section = GRID_MAP[g];
      var rows = payload[section.rowsKey];
      if (!Array.isArray(rows) || rows.length === 0) continue;

      for (var r = 0; r < rows.length; r++) {
        totalRows++;
        var rowObj = rows[r];

        if (section.preClickSelector) {
          var openBtn = querySelectorDeep(section.preClickSelector);
          if (!openBtn) {
            missing.push(section.label + ' row ' + (r + 1));
            continue;
          }
          openBtn.click();
          if (section.fields.length > 0) {
            await waitForElement(section.fields[0].selector, 3000);
          }
        }

        var rowOk = true;
        for (var f = 0; f < section.fields.length; f++) {
          var rf = section.fields[f];
          var rVal = rowObj[rf.key];
          if (rVal === undefined || rVal === null || rVal === '') continue;

          var rEl = querySelectorDeep(rf.selector);
          if (!rEl) {
            rowOk = false;
            missing.push(section.label + ' -> ' + rf.label);
            continue;
          }
          if (!setFrameworkValue(rEl, rVal, rf.type)) {
            highlightYellow(rEl);
            rowOk = false;
          }
        }

        var addBtn = querySelectorDeep(section.addButtonSelector);
        if (addBtn) {
          addBtn.click();
          if (rowOk) filledRows++;
          await sleep(typeof section.rowDelayMs === 'number' ? section.rowDelayMs : 350);
        } else {
          missing.push(section.label + ' (Add button)');
        }
      }
    }

    var summary = 'IRD Auto-Fill: ' + filled + '/' + activeFields.length + ' fields';
    if (totalRows > 0) {
      summary += ' & ' + filledRows + '/' + totalRows + ' schedule rows';
    }
    summary += ' populated';

    showToast(summary, missing);
  } catch (err) {
    alert('IRD Auto-Fill Error: ' + (err && err.message ? err.message : String(err)));
  }
})();`;
}
