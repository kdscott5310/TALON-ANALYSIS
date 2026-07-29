/**
 * BOM & procurement sheet — Milestone 7E.
 *
 * Assembles a bill of materials from accumulated sizing results
 * (`calculations/componentSizing.assembleBom`) and generates a procurement
 * search sheet / RFQ (`reports/procurementSheet.ts`). The output distinguishes
 * calculated requirement / recommended minimum / selected / verified; a demand
 * with no passing candidate becomes a PROCUREMENT REQUIRED line, never a
 * fabricated part. No engineering math here (Rules 2/7).
 */
import { useMemo } from 'react';
import { useAppStore } from '../state/store';
import { assembleBom, type SizingResult } from '../calculations/componentSizing';
import {
  buildProcurementSheet,
  procurementSheetCsv,
} from '../reports/procurementSheet';
import { formatForce } from '../units/units';

export interface BomItem {
  result: SizingResult;
  ratingKey: string;
}

function download(filename: string, text: string): void {
  const blob = new Blob([text], { type: 'text/csv' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  a.click();
  URL.revokeObjectURL(url);
}

export function LibraryProcurementPanel({ items, onClear }: { items: BomItem[]; onClear: () => void }) {
  const unitSystem = useAppStore((s) => s.unitSystem);
  const results = useMemo(() => items.map((i) => i.result), [items]);
  const ratingKeyByLabel = useMemo(
    () => Object.fromEntries(items.map((i) => [i.result.demandLabel, i.ratingKey])),
    [items],
  );
  const bom = useMemo(() => assembleBom(results), [results]);
  const sheet = useMemo(
    () => buildProcurementSheet(results, ratingKeyByLabel),
    [results, ratingKeyByLabel],
  );

  return (
    <section className="results-panel">
      <h2>Bill of materials &amp; procurement</h2>
      {items.length === 0 ? (
        <p className="note">
          Size a component (above) and choose “add to BOM” to build a bill of
          materials and a procurement search sheet.
        </p>
      ) : (
        <>
          <div className="inspector-actions no-print">
            <button type="button" onClick={() => download('procurement-sheet.csv', procurementSheetCsv(sheet))}>
              Export procurement CSV
            </button>
            <button type="button" onClick={onClear}>Clear BOM</button>
          </div>

          <div className="compare-table-wrap">
            <table className="compare-table">
              <thead>
                <tr><th>#</th><th>Requirement</th><th>Category</th><th>Calculated requirement</th><th>Disposition</th><th>Verified</th></tr>
              </thead>
              <tbody>
                {bom.map((l, i) => {
                  const line = sheet.lines[i];
                  return (
                    <tr key={l.itemNumber}>
                      <td>{l.itemNumber}</td>
                      <td>{l.label}</td>
                      <td>{l.category}</td>
                      <td>{formatForce(l.requiredRating, unitSystem)}</td>
                      <td>
                        {l.selected
                          ? <span className="st-ok">{l.selected.name}{l.selected.partNumber ? ` (${l.selected.partNumber})` : ''}</span>
                          : <span className="st-failed">PROCUREMENT REQUIRED</span>}
                      </td>
                      <td>{line?.selected ? (line.selected.verified ? 'yes' : 'no') : 'n/a'}</td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>

          <details>
            <summary>Procurement search phrases &amp; RFQ text</summary>
            {sheet.lines.map((l, i) => (
              <div key={`${l.requirementLabel}-${i}`} className="rfq-block">
                <p className="note"><strong>{l.requirementLabel}</strong> — search: {l.searchPhrase}</p>
                <pre className="run-header">{l.rfqText}</pre>
              </div>
            ))}
          </details>

          <p className="note">{sheet.disclaimer}</p>
        </>
      )}
    </section>
  );
}
