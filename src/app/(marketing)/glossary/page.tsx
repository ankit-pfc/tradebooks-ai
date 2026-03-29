import { Metadata } from 'next';
import Link from 'next/link';
import { glossaryTerms } from '@/data/glossary';

export const metadata: Metadata = {
  title: 'Accounting and Trading Glossary for Indian Taxpayers | Tradebooks AI',
  description: 'Understand key terms and definitions for Indian trading taxation, capital gains, Tally accounting, and Zerodha exports.',
};

export default function GlossaryIndexPage() {
  return (
    <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8 py-16">
      <div className="mb-12">
        <h1 className="text-4xl font-bold tracking-tight text-slate-900 sm:text-5xl mb-4">
          Accounting & Trading Glossary
        </h1>
        <p className="text-xl text-slate-600 max-w-3xl">
          Clear, CA-verified definitions for trading taxation, capital gains, and Tally accounting workflows. 
          Built for Indian professionals and retail investors.
        </p>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
        {glossaryTerms.map((term) => (
          <Link 
            key={term.slug} 
            href={`/glossary/${term.slug}`}
            className="block group rounded-xl border border-slate-200 bg-white p-6 shadow-sm hover:border-[#387ED1] hover:shadow-md transition-all"
          >
            <h2 className="text-lg font-semibold text-slate-900 mb-2 group-hover:text-[#387ED1]">
              {term.title.replace(' | Tradebooks AI', '')}
            </h2>
            <p className="text-sm text-slate-600 line-clamp-3">
              {term.shortDefinition}
            </p>
            <div className="mt-4 flex items-center text-sm font-medium text-[#387ED1]">
              Read definition &rarr;
            </div>
          </Link>
        ))}
      </div>
    </div>
  );
}
