"use client";

import { useState } from "react";
import { NAGRIK_TAXONOMY_V1, type SupportedLanguage, getResolvedLabel } from "@/lib/taxonomy/nagrik-taxonomy.v1";
import { Layers, HelpCircle, Check, Globe } from "lucide-react";

export function CategoryExplorer() {
  const [activeLang, setActiveLang] = useState<SupportedLanguage>("en");
  const [selectedGroupIndex, setSelectedGroupIndex] = useState<number>(0);

  const activeGroup = NAGRIK_TAXONOMY_V1[selectedGroupIndex];

  return (
    <section id="categories" className="py-16 md:py-24 bg-slate-50 dark:bg-slate-950 border-b border-slate-200 dark:border-slate-800">
      <div className="max-w-6xl mx-auto px-4">
        {/* Header */}
        <div className="max-w-2xl mx-auto text-center space-y-3 mb-10">
          <h2 className="text-2xl sm:text-3xl font-bold tracking-tight text-slate-900 dark:text-white">
            What you can report
          </h2>
          <p className="text-sm text-slate-500 dark:text-slate-400">
            Every report goes into one of three groups and twelve categories, so it reaches the right team the first time. Can&apos;t find yours? Choose “Other” and describe it.
          </p>

          {/* Language Switcher */}
          <div className="pt-2 flex flex-wrap items-center justify-center gap-2">
            <span className="text-xs text-slate-500 font-semibold flex items-center gap-1.5 mr-1">
              <Globe className="w-4 h-4 text-emerald-600" /> Language:
            </span>
            {(
              [
                { code: "en", label: "English" },
                { code: "hi", label: "हिन्दी" },
                { code: "mr", label: "मराठी" },
              ] as const
            ).map((lang) => (
              <button
                key={lang.code}
                onClick={() => setActiveLang(lang.code)}
                className={`text-xs px-3.5 py-2 min-h-[44px] rounded-xl font-bold transition focus:outline-none focus:ring-2 focus:ring-brand-500 ${
 activeLang === lang.code
 ? "bg-brand-600 text-white shadow-xs"
 : "bg-white dark:bg-slate-800 text-slate-700 dark:text-slate-300 border border-slate-200 dark:border-slate-700 hover:bg-slate-100 dark:hover:bg-slate-700"
 }`}
                aria-pressed={activeLang === lang.code}
              >
                {lang.label}
              </button>
            ))}
          </div>
        </div>

        {/* Group Tabs */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-3 mb-8">
          {NAGRIK_TAXONOMY_V1.map((group, idx) => {
            const isSelected = selectedGroupIndex === idx;
            return (
              <button
                key={group.groupId}
                onClick={() => setSelectedGroupIndex(idx)}
                className={`p-4 rounded-xl border text-left transition relative flex flex-col justify-between focus:outline-none focus:ring-2 focus:ring-brand-500 ${
 isSelected
 ? "bg-white dark:bg-slate-900 border-brand-500 shadow-sm ring-1 ring-brand-500/20"
 : "bg-white/60 dark:bg-slate-900/40 border-slate-200 dark:border-slate-800 hover:bg-white dark:hover:bg-slate-900"
 }`}
              >
                <div className="flex items-center justify-between mb-2">
                  <span className="text-xs font-semibold text-brand-600 dark:text-brand-400">
                    Group {idx + 1}
                  </span>
                  {isSelected && <Check className="w-4 h-4 text-brand-600" />}
                </div>
                <h3 className="font-bold text-sm text-slate-900 dark:text-white">
                  {getResolvedLabel(group.label, activeLang)}
                </h3>
                <span className="text-xs text-slate-400 mt-1">
                  4 categories &middot; 20 leaf options
                </span>
              </button>
            );
          })}
        </div>

        {/* Category & Leaf Breakdown Card */}
        <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl p-6 sm:p-8 shadow-sm">
          <div className="flex items-center gap-2 mb-6 pb-4 border-b border-slate-100 dark:border-slate-800">
            <Layers className="w-5 h-5 text-brand-600 shrink-0" />
            <div>
              <h4 className="font-bold text-base text-slate-900 dark:text-white">
                {getResolvedLabel(activeGroup.label, activeLang)}
              </h4>
              <p className="text-xs text-slate-500">
                Detailed categories and specific defect options configured in Nagrik.
              </p>
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            {activeGroup.categories.map((cat, catIdx) => (
              <div
                key={cat.categoryId}
                className="border border-slate-100 dark:border-slate-800 rounded-xl p-4 bg-slate-50/50 dark:bg-slate-800/20"
              >
                <div className="flex items-center justify-between mb-3">
                  <span className="text-xs font-bold text-slate-900 dark:text-white">
                    {catIdx + 1}. {getResolvedLabel(cat.label, activeLang)}
                  </span>
                </div>

                <ul className="space-y-1.5">
                  {cat.options.map((opt) => (
                    <li
                      key={opt.issueTypeId}
                      className="text-xs text-slate-600 dark:text-slate-300 flex items-center gap-2"
                    >
                      <span className="w-1.5 h-1.5 rounded-full bg-slate-300 dark:bg-slate-600 shrink-0" />
                      <span>{getResolvedLabel(opt.label, activeLang)}</span>
                      {opt.issueTypeId === "other" && (
                        <span className="text-xs px-1 rounded bg-amber-100 dark:bg-amber-950 text-amber-800 dark:text-amber-300">
                          Requires description
                        </span>
                      )}
                    </li>
                  ))}
                </ul>
              </div>
            ))}
          </div>

          <div className="mt-6 pt-4 border-t border-slate-100 dark:border-slate-800 text-xs text-slate-500 flex items-center gap-2">
            <HelpCircle className="w-4 h-4 text-slate-400 shrink-0" />
            <span>
              <strong>Note on Taxonomy Rules:</strong> Selecting &quot;Other&quot; automatically routes the submission to manual human review. AI is never permitted to reclassify categories automatically.
            </span>
          </div>
        </div>
      </div>
    </section>
  );
}
