/**
 * IRD RAMIS Bookmarklet Generator Card
 *
 * Renders a CSP-safe, zero-network bookmarklet generator UI:
 * - Draggable <a> button ("Drag to Bookmarks Bar to Auto-Fill IRD")
 * - "Copy Bookmarklet Code" fallback button
 * - Modal to inspect/edit the JSON payload or view the unminified payload script
 */

import { useEffect, useMemo, useRef, useState } from 'react';
import { Bookmark, Check, Code2, Copy, GripVertical, ShieldAlert } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from '@/components/ui/dialog';
import {
  generateIrdBookmarklet,
  type IrdTaxPayload,
} from '@/utils/bookmarkletGenerator';
import { DEFAULT_RAMIS_FIELD_MAP } from '@/lib/irdBookmarkletPayload';

interface IrdBookmarkletCardProps {
  taxData: IrdTaxPayload;
  taxYearLabel?: string;
}

export function IrdBookmarkletCard({ taxData, taxYearLabel }: IrdBookmarkletCardProps) {
  const [customJson, setCustomJson] = useState<string>(() => JSON.stringify(taxData, null, 2));
  const [copiedUri, setCopiedUri] = useState(false);
  const [copiedSource, setCopiedSource] = useState(false);
  const [activeTab, setActiveTab] = useState<'json' | 'source'>('json');
  const anchorRef = useRef<HTMLAnchorElement | null>(null);

  // Sync custom JSON when computed taxData changes
  useEffect(() => {
    setCustomJson(JSON.stringify(taxData, null, 2));
  }, [taxData]);

  const { parsedPayload, jsonError } = useMemo<{
    parsedPayload: IrdTaxPayload;
    jsonError: string | null;
  }>(() => {
    try {
      const parsed = JSON.parse(customJson);
      if (parsed && typeof parsed === 'object' && !Array.isArray(parsed)) {
        return { parsedPayload: parsed as IrdTaxPayload, jsonError: null };
      }
      return { parsedPayload: taxData, jsonError: 'Payload must be a JSON object.' };
    } catch (err) {
      return {
        parsedPayload: taxData,
        jsonError: err instanceof Error ? err.message : 'Invalid JSON',
      };
    }
  }, [customJson, taxData]);

  const bookmarklet = useMemo(
    () => generateIrdBookmarklet(parsedPayload, DEFAULT_RAMIS_FIELD_MAP),
    [parsedPayload]
  );

  // Set javascript: href imperatively via ref to avoid React's javascript: URL warning
  useEffect(() => {
    if (anchorRef.current) {
      anchorRef.current.setAttribute('href', bookmarklet.uri);
    }
  }, [bookmarklet.uri]);

  const handleCopyUri = async () => {
    await navigator.clipboard.writeText(bookmarklet.uri);
    setCopiedUri(true);
    setTimeout(() => setCopiedUri(false), 2500);
  };

  const handleCopySource = async () => {
    await navigator.clipboard.writeText(bookmarklet.unminifiedSource);
    setCopiedSource(true);
    setTimeout(() => setCopiedSource(false), 2500);
  };

  const sizeKb = (bookmarklet.byteSize / 1024).toFixed(1);

  return (
    <Card className="border-blue-200 bg-gradient-to-br from-white to-blue-50/40">
      <CardHeader>
        <div className="flex items-start justify-between gap-4">
          <div>
            <CardTitle className="flex items-center gap-2 text-lg">
              <Bookmark className="h-5 w-5 text-blue-600" />
              IRD RAMIS Auto-Fill Bookmarklet
            </CardTitle>
            <CardDescription className="mt-1">
              {taxYearLabel ? `Tax Year ${taxYearLabel} • ` : ''}
              Runs 100% offline inside the IRD RAMIS portal with zero external network requests or browser extensions.
            </CardDescription>
          </div>
          <span className="shrink-0 rounded-full bg-blue-100 px-2.5 py-1 text-xs font-medium text-blue-800">
            {bookmarklet.fieldCount} fields • {sizeKb} KB
          </span>
        </div>
      </CardHeader>

      <CardContent className="space-y-4">
        {/* Primary Actions: Draggable Bookmarklet + Copy Fallback */}
        <div className="flex flex-wrap items-center gap-3">
          <a
            ref={anchorRef}
            draggable
            onClick={(e) => e.preventDefault()}
            title="Drag this button to your browser Bookmarks Bar"
            className="inline-flex cursor-grab items-center gap-2 rounded-md bg-blue-600 px-4 py-2.5 text-sm font-medium text-white shadow-sm transition-colors hover:bg-blue-700 active:cursor-grabbing select-none"
          >
            <GripVertical className="h-4 w-4 opacity-80" />
            Drag to Bookmarks Bar to Auto-Fill IRD
          </a>

          <Button type="button" variant="outline" onClick={handleCopyUri}>
            {copiedUri ? (
              <>
                <Check className="mr-2 h-4 w-4 text-green-600" />
                Copied Bookmarklet Code
              </>
            ) : (
              <>
                <Copy className="mr-2 h-4 w-4" />
                Copy Bookmarklet Code
              </>
            )}
          </Button>

          <Dialog>
            <DialogTrigger asChild>
              <Button type="button" variant="ghost" size="sm">
                <Code2 className="mr-2 h-4 w-4" />
                Inspect / Customize Payload
              </Button>
            </DialogTrigger>
            <DialogContent className="max-w-3xl max-h-[85vh] flex flex-col">
              <DialogHeader>
                <DialogTitle>IRD Bookmarklet Payload &amp; Source</DialogTitle>
                <DialogDescription>
                  Review or adjust the embedded tax JSON, or inspect the unminified RAMIS auto-fill script before encoding.
                </DialogDescription>
              </DialogHeader>

              <div className="flex gap-2 border-b pb-2">
                <Button
                  type="button"
                  size="sm"
                  variant={activeTab === 'json' ? 'default' : 'outline'}
                  onClick={() => setActiveTab('json')}
                >
                  Tax Data JSON
                </Button>
                <Button
                  type="button"
                  size="sm"
                  variant={activeTab === 'source' ? 'default' : 'outline'}
                  onClick={() => setActiveTab('source')}
                >
                  Unminified Payload Script
                </Button>
              </div>

              {activeTab === 'json' ? (
                <div className="space-y-2 flex-1 overflow-hidden flex flex-col">
                  <textarea
                    value={customJson}
                    onChange={(e) => setCustomJson(e.target.value)}
                    spellCheck={false}
                    className="w-full h-72 rounded-md border bg-slate-950 p-3 font-mono text-xs text-slate-100 focus:outline-none focus:ring-2 focus:ring-blue-500"
                  />
                  {jsonError && (
                    <p className="text-xs text-red-600 font-medium">JSON Error: {jsonError} (using last valid payload)</p>
                  )}
                </div>
              ) : (
                <div className="space-y-2 flex-1 overflow-hidden flex flex-col">
                  <div className="flex justify-end">
                    <Button type="button" size="sm" variant="outline" onClick={handleCopySource}>
                      {copiedSource ? 'Copied Script' : 'Copy Unminified Script'}
                    </Button>
                  </div>
                  <pre className="w-full h-72 overflow-auto rounded-md border bg-slate-950 p-3 font-mono text-xs text-slate-100">
                    {bookmarklet.unminifiedSource}
                  </pre>
                </div>
              )}
            </DialogContent>
          </Dialog>
        </div>

        {/* How to use + Privacy notice */}
        <div className="grid gap-3 sm:grid-cols-2 text-xs text-gray-600">
          <div className="rounded-md border bg-white p-3">
            <p className="font-semibold text-gray-800 mb-1">How to use on IRD RAMIS:</p>
            <ol className="list-decimal list-inside space-y-0.5">
              <li>Show your browser&apos;s Bookmarks Bar (<kbd className="px-1 py-0.5 bg-gray-100 rounded">Ctrl+Shift+B</kbd>).</li>
              <li>Drag the blue button above onto the Bookmarks Bar (or copy &amp; paste as a new bookmark URL).</li>
              <li>Open your IIT Return on <strong>eservices.ird.gov.lk</strong> and click the bookmark.</li>
            </ol>
          </div>
          <div className="rounded-md border border-amber-200 bg-amber-50/70 p-3 text-amber-900 flex gap-2">
            <ShieldAlert className="h-4 w-4 shrink-0 mt-0.5 text-amber-600" />
            <div>
              <p className="font-semibold mb-1">Privacy Note</p>
              <p>
                Your tax figures are embedded directly inside the bookmarklet in Base64 (no server calls). Delete the bookmark after filing if using a shared or synced browser profile.
              </p>
            </div>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}
