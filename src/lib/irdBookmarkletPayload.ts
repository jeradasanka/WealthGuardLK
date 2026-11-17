/**
 * Unminified, readable IRD RAMIS Bookmarklet Payload Builder.
 *
 * Generates the self-contained JavaScript payload injected via a `javascript:`
 * bookmarklet URI. Designed to run 100% offline inside the target page with
 * zero external network requests (CSP-safe) and zero `innerHTML` usage
 * (Trusted-Types-safe).
 *
 * Tailored for Sri Lanka IRD RAMIS (`https://eservices.ird.gov.lk`) which uses
 * ASP.NET MVC + jQuery + Telerik Kendo UI (`numerictextbox`, `dropdownlist`,
 * `datepicker`), while also supporting standard React, Angular, and WebForms
 * inputs via native property descriptors.
 */

export interface IrdFieldMapping {
  /** Key in the embedded JSON payload */
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

/**
 * Default field mapping for IRD RAMIS Individual Income Tax Return (IIT2).
 *
 * ============================================================================
 * WHERE TO PLUG IN / CUSTOMIZE IRD FORM FIELD SELECTORS:
 * Add or edit entries below to target additional RAMIS schedules or cages.
 * Verified IDs from RAMIS `MainReturnForm` & `Schedule8Form`:
 *   - `#DeclarationTax_Rtn_Cage10` : Employment income (Rs.)
 *   - `#DeclarationTax_Rtn_Cage20` : Business income (Rs.)
 *   - `#DeclarationTax_Rtn_Cage30` : Investment income (Rs.)
 *   - `#DeclarationTax_Rtn_Cage40` : Other income (Rs.)
 *   - `#Deduction_Rtn_Cage100`     : Personal relief (Rs.)
 *   - `#Deduction_Rtn_Cage120`     : Qualifying payments (Rs.)
 *   - `#Sch8_Cage801`              : Schedule 8 total assessable income
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
];

/**
 * Returns the unminified, readable source code of the injected bookmarklet
 * payload with the UTF-8 Base64 data and field map embedded.
 */
export function buildUnminifiedIrdPayloadScript(
  encodedPayloadBase64: string,
  fieldMap: IrdFieldMapping[] = DEFAULT_RAMIS_FIELD_MAP
): string {
  const serializedMap = JSON.stringify(fieldMap, null, 2);

  return `(async function () {
  'use strict';

  /* 1. Embedded UTF-8 Base64 Tax Payload (zero external network calls) */
  var ENCODED_DATA = ${JSON.stringify(encodedPayloadBase64)};

  /* 2. Field Mapping: plug in or adjust IRD RAMIS CSS selectors here */
  var FIELD_MAP = ${serializedMap};

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
   * dependent fields (e.g. after a dropdown selection).
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

  /**
   * Dispatches native input, change, and blur events with { bubbles: true }
   * so React, Angular, jQuery, and ASP.NET WebForms register the update.
   */
  function dispatchNativeEvents(el) {
    var eventNames = ['input', 'change', 'blur'];
    for (var i = 0; i < eventNames.length; i++) {
      el.dispatchEvent(new Event(eventNames[i], { bubbles: true, cancelable: true }));
    }
  }

  /**
   * Sets a native element value via its prototype property descriptor
   * (bypasses React's internal value tracker override).
   */
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

  /**
   * Highlights a Kendo widget wrapper or raw element in yellow when manual
   * review is needed (e.g. missing selector or unmatched option).
   */
  function highlightYellow(el) {
    if (!el) return;
    var target = (el.closest && el.closest('.k-widget')) || el;
    target.style.outline = '2px solid #eab308';
    target.style.backgroundColor = '#fef9c3';
  }

  /**
   * Sets a form field safely, handling Telerik Kendo UI widgets (used on RAMIS),
   * standard <select> (matching by value or visible text), checkboxes, radios,
   * and standard text/number inputs.
   */
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

    /* D. Standard <input type="text|number"> or <textarea> */
    setNativeValue(el, rawValue);
    return true;
  }

  /**
   * Renders a non-intrusive, Trusted-Types-safe floating toast in the
   * top-right corner of the target page (uses createElement + textContent only).
   */
  function showToast(filledCount, totalCount, missingLabels) {
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
    toast.style.maxWidth = '340px';
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
    title.textContent = 'IRD Auto-Fill: ' + filledCount + '/' + totalCount + ' fields populated';

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
    }, 10000);
  }

  /* 3. Execute Auto-Fill */
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

      var ok = setFrameworkValue(el, value, field.type);
      if (ok) {
        filled++;
      } else {
        highlightYellow(el);
        missing.push(field.label);
      }
    }

    showToast(filled, activeFields.length, missing);
  } catch (err) {
    alert('IRD Auto-Fill Error: ' + (err && err.message ? err.message : String(err)));
  }
})();`;
}
