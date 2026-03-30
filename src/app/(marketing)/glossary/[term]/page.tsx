import { Metadata } from 'next';
import { notFound } from 'next/navigation';
import Link from 'next/link';
import { glossaryTerms } from '@/data/glossary';
import { CheckCircle2 } from 'lucide-react';

type Props = {
  params: Promise<{ term: string }>;
};

// Generate static params for build time pre-rendering
export async function generateStaticParams() {
  return glossaryTerms.map((term) => ({
    term: term.slug,
  }));
}

// Generate dynamic metadata
export async function generateMetadata(
  { params }: Props
): Promise<Metadata> {
  const resolvedParams = await params;
  const termData = glossaryTerms.find((t) => t.slug === resolvedParams.term);
  
  if (!termData) {
    return {
      title: 'Term Not Found | Tradebooks AI',
    };
  }
  
  return {
    title: termData.title,
    description: termData.metaDescription,
  };
}

export default async function GlossaryTermPage({ params }: Props) {
  const resolvedParams = await params;
  const termData = glossaryTerms.find((t) => t.slug === resolvedParams.term);

  if (!termData) {
    notFound();
  }

  // Schema.org Article/FAQ structured data
  const jsonLd = {
    '@context': 'https://schema.org',
    '@type': 'FAQPage',
    mainEntity: [{
      '@type': 'Question',
      name: termData.title.replace(' | Tradebooks AI', ''),
      acceptedAnswer: {
        '@type': 'Answer',
        text: termData.shortDefinition,
      }
    }]
  };

  const related = glossaryTerms.filter(t => termData.relatedTerms.includes(t.slug));

  return (
    <>
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd) }}
      />
      
      <div className="mx-auto max-w-4xl px-4 sm:px-6 lg:px-8 py-16">
        {/* Breadcrumb */}
        <nav className="mb-8 text-sm text-slate-500 font-medium">
          <Link href="/glossary" className="hover:text-[#387ED1]">Glossary</Link>
          <span className="mx-2">/</span>
          <span className="text-slate-900 capitalize">{resolvedParams.term.replace(/-/g, ' ')}</span>
        </nav>

        <article className="prose prose-slate lg:prose-lg max-w-none">
          <h1 className="text-3xl sm:text-4xl font-bold tracking-tight text-slate-900 mb-6">
            {termData.title.replace(' | Tradebooks AI', '')}
          </h1>
          
          <div className="bg-slate-50 border border-slate-200 rounded-xl p-6 mb-10">
            <h2 className="text-lg font-semibold text-slate-900 mt-0 mb-2">Short Definition</h2>
            <p className="text-slate-700 m-0 leading-relaxed font-medium">
              {termData.shortDefinition}
            </p>
          </div>

          {/* Detailed explanation parsed from HTML string */}
          <div 
            className="mb-12"
            dangerouslySetInnerHTML={{ __html: termData.detailedExplanation }}
          />
        </article>

        <div className="my-12 py-8 px-6 bg-[#121725] rounded-2xl flex flex-col md:flex-row items-center justify-between gap-6 shadow-xl text-white">
          <div>
            <h3 className="text-xl font-bold mb-2">Automate this workflow with Tradebooks AI</h3>
            <p className="text-slate-300">Convert Zerodha trading exports directly into accurate Tally XML vouchers.</p>
            <ul className="mt-4 flex flex-col gap-2 text-sm text-slate-300">
              <li className="flex items-center gap-2"><CheckCircle2 className="h-4 w-4 text-[#2D9D78]" /> Automatic FIFO calculation</li>
              <li className="flex items-center gap-2"><CheckCircle2 className="h-4 w-4 text-[#2D9D78]" /> Split Intraday and Delivery</li>
            </ul>
          </div>
          <Link
            href="/upload"
            className="flex-shrink-0 inline-flex items-center justify-center rounded-lg bg-[#387ED1] px-6 py-3 font-semibold text-white transition-colors hover:bg-[#2f6db7]"
          >
            Start Free Trial
          </Link>
        </div>

        {related.length > 0 && (
          <div className="mt-16 pt-10 border-t border-slate-200">
            <h2 className="text-2xl font-bold text-slate-900 mb-6">Related Terms</h2>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              {related.map(rel => (
                <Link
                  key={rel.slug}
                  href={`/glossary/${rel.slug}`}
                  className="block p-4 rounded-lg border border-slate-200 bg-white hover:border-[#387ED1] hover:shadow-sm"
                >
                  <div className="font-semibold text-slate-900 group-hover:text-[#387ED1]">
                    {rel.title.replace(' | Tradebooks AI', '')}
                  </div>
                </Link>
              ))}
            </div>
          </div>
        )}
      </div>
    </>
  );
}
