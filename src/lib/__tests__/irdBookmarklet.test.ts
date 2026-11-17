import { describe, it, expect, beforeEach, vi } from 'vitest';
import {
  encodePayloadUTF8,
  decodePayloadUTF8,
  generateIrdBookmarklet,
  buildIrdPayloadFromComputation,
} from '@/utils/bookmarkletGenerator';
import type { IrdFieldMapping, IrdGridMapping } from '@/lib/irdBookmarkletPayload';

describe('IRD Bookmarklet Generator & Payload Runner', () => {
  beforeEach(() => {
    document.body.innerHTML = '';
    delete (window as unknown as Record<string, unknown>).jQuery;
  });

  it('encodes and decodes UTF-8 payloads including Unicode characters', () => {
    const sample = {
      employmentIncome: 2450000,
      taxpayerName: 'කමල් පෙරේරා — Colombo 07',
      tamilNote: 'வருமான வரி',
    };

    const encoded = encodePayloadUTF8(sample);
    const decoded = decodePayloadUTF8<typeof sample>(encoded);

    expect(decoded).toEqual(sample);
  });

  it('maps computation totals into RAMIS payload', () => {
    const payload = buildIrdPayloadFromComputation({
      employmentTotal: 3000000,
      businessTotal: 500000,
      investmentTotal: 100000,
      derivedInvestmentTotal: 25000.456,
      otherTotal: 0,
      personalRelief: 1200000,
      solarRelief: 600000,
    });

    expect(payload).toEqual({
      employmentIncome: 3000000,
      businessIncome: 500000,
      investmentIncome: 125000.46,
      otherIncome: 0,
      personalRelief: 1200000,
      qualifyingPayments: 600000,
    });
  });

  it('generates a valid minified javascript: URI with no raw newlines', () => {
    const result = generateIrdBookmarklet({
      employmentIncome: 1500000,
      personalRelief: 1200000,
    });

    expect(result.uri.startsWith('javascript:')).toBe(true);
    expect(result.uri).not.toContain('\n');
    expect(result.fieldCount).toBe(2);
    expect(result.byteSize).toBeGreaterThan(500);

    // Verify minified JS parses cleanly
    const jsBody = decodeURIComponent(result.uri.slice('javascript:'.length));
    expect(() => new Function(jsBody)).not.toThrow();
  });

  it('populates standard inputs, selects (by text/value), checkboxes, radios, Kendo widgets, and async fields', async () => {
    document.body.innerHTML = `
      <form id="testForm">
        <input id="empInput" type="number" />
        <select id="sourceSelect">
          <option value="">-- Select --</option>
          <option value="EMP">Employment Income</option>
          <option value="BUS">Business Income</option>
        </select>
        <input id="agreeCheck" type="checkbox" />
        <input id="resYes" type="radio" name="resStatus" value="RES" />
        <input id="resNo" type="radio" name="resStatus" value="NONRES" />
        <input id="kendoNum" type="text" data-role="numerictextbox" />
      </form>
      <div id="dynamicContainer"></div>
    `;

    const eventsFired: string[] = [];
    const empInput = document.getElementById('empInput') as HTMLInputElement;
    empInput.addEventListener('input', () => eventsFired.push('input'));
    empInput.addEventListener('change', () => eventsFired.push('change'));
    empInput.addEventListener('blur', () => eventsFired.push('blur'));

    // Mock jQuery + Kendo NumericTextBox
    const kendoValueSpy = vi.fn();
    const kendoTriggerSpy = vi.fn();
    (window as unknown as Record<string, unknown>).jQuery = () => ({
      data: (key: string) =>
        key === 'kendoNumericTextBox'
          ? { value: kendoValueSpy, trigger: kendoTriggerSpy }
          : null,
    });

    // Dynamically render an async dependent field after 30ms
    setTimeout(() => {
      const container = document.getElementById('dynamicContainer')!;
      const asyncInput = document.createElement('input');
      asyncInput.id = 'asyncField';
      asyncInput.type = 'text';
      container.appendChild(asyncInput);
    }, 30);

    const customMap: IrdFieldMapping[] = [
      { key: 'emp', label: 'Employment', selector: '#empInput', type: 'number' },
      { key: 'src', label: 'Source', selector: '#sourceSelect', type: 'select' },
      { key: 'agree', label: 'Agree', selector: '#agreeCheck', type: 'checkbox' },
      { key: 'res', label: 'Resident', selector: 'input[name="resStatus"]', type: 'radio' },
      { key: 'kNum', label: 'Kendo Number', selector: '#kendoNum', type: 'number' },
      {
        key: 'dyn',
        label: 'Dynamic Field',
        selector: '#asyncField',
        waitFor: '#asyncField',
        waitTimeoutMs: 1000,
      },
      { key: 'missingKey', label: 'Missing Field', selector: '#doesNotExist' },
    ];

    const { uri } = generateIrdBookmarklet(
      {
        emp: 2500000,
        src: 'Business Income', // Match by visible text
        agree: true,
        res: 'NONRES',
        kNum: 750000,
        dyn: 'LoadedAsync',
        missingKey: 999,
      },
      customMap
    );

    const jsBody = decodeURIComponent(uri.slice('javascript:'.length));
    // Execute the async IIFE
    const runner = new Function(`return ${jsBody}`);
    await runner();

    expect(empInput.value).toBe('2500000');
    expect(eventsFired).toEqual(['input', 'change', 'blur']);
    expect((document.getElementById('sourceSelect') as HTMLSelectElement).value).toBe('BUS');
    expect((document.getElementById('agreeCheck') as HTMLInputElement).checked).toBe(true);
    expect((document.getElementById('resNo') as HTMLInputElement).checked).toBe(true);
    expect(kendoValueSpy).toHaveBeenCalledWith(750000);
    expect(kendoTriggerSpy).toHaveBeenCalledWith('change');
    expect((document.getElementById('asyncField') as HTMLInputElement).value).toBe('LoadedAsync');

    // Verify floating toast notification
    const toast = document.getElementById('wg-ird-autofill-toast');
    expect(toast).not.toBeNull();
    expect(toast?.textContent).toContain('IRD Auto-Fill: 6/7 fields populated');
    expect(toast?.textContent).toContain('Missing Field');
  });

  it('populates repeating Kendo Grid rows via preClickSelector and addButtonSelector', async () => {
    document.body.innerHTML = `
      <input id="mainCage10" type="number" />
      <button id="openModalBtn" type="button">Add Row</button>
      <div id="modalArea"></div>
    `;

    const addedRows: Array<{ employer: string; amount: string }> = [];

    document.getElementById('openModalBtn')!.addEventListener('click', () => {
      document.getElementById('modalArea')!.innerHTML = `
        <input id="rowEmp" type="text" />
        <input id="rowAmt" type="number" />
        <button id="submitRowBtn" type="button">Add</button>
      `;
      document.getElementById('submitRowBtn')!.addEventListener('click', () => {
        addedRows.push({
          employer: (document.getElementById('rowEmp') as HTMLInputElement).value,
          amount: (document.getElementById('rowAmt') as HTMLInputElement).value,
        });
      });
    });

    const fieldMap: IrdFieldMapping[] = [
      { key: 'empTotal', label: 'Emp Total', selector: '#mainCage10', type: 'number' },
    ];
    const gridMap: IrdGridMapping[] = [
      {
        rowsKey: 'schedule1Rows',
        label: 'Schedule 1A',
        preClickSelector: '#openModalBtn',
        addButtonSelector: '#submitRowBtn',
        rowDelayMs: 10,
        fields: [
          { key: 'employerName', label: 'Employer', selector: '#rowEmp', type: 'text' },
          { key: 'amount', label: 'Amount', selector: '#rowAmt', type: 'number' },
        ],
      },
    ];

    const { uri } = generateIrdBookmarklet(
      {
        empTotal: 3000000,
        schedule1Rows: [
          { employerName: 'Acme Pvt Ltd', amount: 2000000 } as never,
          { employerName: 'Beta Corp', amount: 1000000 } as never,
        ],
      },
      fieldMap,
      gridMap
    );

    const jsBody = decodeURIComponent(uri.slice('javascript:'.length));
    await new Function(`return ${jsBody}`)();

    expect((document.getElementById('mainCage10') as HTMLInputElement).value).toBe('3000000');
    expect(addedRows).toEqual([
      { employer: 'Acme Pvt Ltd', amount: '2000000' },
      { employer: 'Beta Corp', amount: '1000000' },
    ]);

    const toast = document.getElementById('wg-ird-autofill-toast');
    expect(toast?.textContent).toContain('IRD Auto-Fill: 1/1 fields & 2/2 schedule rows populated');
  });
});
