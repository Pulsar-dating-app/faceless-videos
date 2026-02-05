"use client";

import { Navbar } from "@/components/Navbar";
import { Footer } from "@/components/Footer";

export default function TermsPage() {
  return (
    <div className="min-h-screen bg-background text-foreground flex flex-col">
      <Navbar />

      {/* Main Content */}
      <main className="flex-1 px-4 py-12 sm:py-20">
        <div className="max-w-4xl mx-auto space-y-8">
          {/* Header */}
          <div className="text-center space-y-4 mb-12">
            <h1 className="text-4xl sm:text-5xl font-extrabold tracking-tight">
              Terms and Conditions
            </h1>
            <p className="text-lg text-zinc-600 dark:text-zinc-400">
              Last updated: [DATE]
            </p>
          </div>

          {/* Terms Content */}
          <div className="prose prose-zinc dark:prose-invert max-w-none">
            <div className="bg-white dark:bg-zinc-900 rounded-2xl border border-zinc-200 dark:border-zinc-800 shadow-xl p-8 sm:p-12 space-y-8">
              
              <section>
                <p className="text-zinc-700 dark:text-zinc-300 leading-relaxed">
                  These Terms and Conditions ("Terms") govern your access to and use of Viral Faceless Reels (the "Service"), operated by:
                </p>
                <div className="mt-4 space-y-2 text-zinc-700 dark:text-zinc-300">
                  <p><strong>Company name:</strong> PULSAR LTDA</p>
                  <p><strong>Registered address:</strong> [YOUR ADDRESS]</p>
                  <p><strong>Company ID / Tax ID:</strong> [NUMBER]</p>
                  <p><strong>Email:</strong> [SUPPORT EMAIL]</p>
                </div>
                <p className="mt-4 text-zinc-700 dark:text-zinc-300 leading-relaxed">
                  By creating an account, purchasing a subscription, or using the Service, you agree to these Terms.
                </p>
                <p className="text-zinc-700 dark:text-zinc-300 leading-relaxed">
                  If you do not agree, you must not use the Service.
                </p>
              </section>

              <section>
                <h2 className="text-2xl font-bold mt-8 mb-4 text-zinc-900 dark:text-zinc-100">1. Description of the Service</h2>
                <p className="text-zinc-700 dark:text-zinc-300 leading-relaxed">
                  Viral Faceless Reels is an AI-powered platform that allows users to automatically generate short-form videos with scripts, audio and subtitles for publication on platforms such as TikTok, Instagram, YouTube Shorts, and other social networks.
                </p>
                <p className="text-zinc-700 dark:text-zinc-300 leading-relaxed mt-4">
                  We may modify, update, or discontinue any part of the Service at any time without notice.
                </p>
              </section>

              <section>
                <h2 className="text-2xl font-bold mt-8 mb-4 text-zinc-900 dark:text-zinc-100">2. Eligibility and Accounts</h2>
                <p className="text-zinc-700 dark:text-zinc-300 leading-relaxed mb-4">
                  You must be at least 18 years old to use the Service.
                </p>
                <p className="text-zinc-700 dark:text-zinc-300 leading-relaxed mb-2">
                  You are responsible for:
                </p>
                <ul className="list-disc list-inside space-y-2 text-zinc-700 dark:text-zinc-300 ml-4">
                  <li>Maintaining account security</li>
                  <li>All activity under your account</li>
                  <li>Providing accurate information</li>
                </ul>
                <p className="text-zinc-700 dark:text-zinc-300 leading-relaxed mt-4">
                  We may suspend or terminate accounts at our sole discretion.
                </p>
              </section>

              <section>
                <h2 className="text-2xl font-bold mt-8 mb-4 text-zinc-900 dark:text-zinc-100">3. Payments, Subscriptions, and Billing</h2>
                <p className="text-zinc-700 dark:text-zinc-300 leading-relaxed">
                  All plans are subscription-based unless stated otherwise.
                </p>
                <p className="text-zinc-700 dark:text-zinc-300 leading-relaxed mt-4">
                  Subscriptions automatically renew unless cancelled before the renewal date.
                </p>
                <p className="text-zinc-700 dark:text-zinc-300 leading-relaxed mt-4">
                  You authorize us and our payment processors to charge your payment method for all fees.
                </p>
                <p className="text-zinc-700 dark:text-zinc-300 leading-relaxed mt-4">
                  Failure to pay may result in suspension or termination.
                </p>
              </section>

              <section>
                <h2 className="text-2xl font-bold mt-8 mb-4 text-zinc-900 dark:text-zinc-100">4. No Refunds & Waiver of Withdrawal Rights (Digital Content)</h2>
                <p className="text-zinc-700 dark:text-zinc-300 leading-relaxed mb-4">
                  Due to the nature of digital content and immediate access to the Service:
                </p>
                <ul className="list-disc list-inside space-y-2 text-zinc-700 dark:text-zinc-300 ml-4">
                  <li>All payments are final and non-refundable.</li>
                  <li>By purchasing, you expressly consent to immediate performance of the Service.</li>
                  <li>You waive any right of withdrawal or refund under applicable consumer protection laws (including EU Directive 2011/83/EU) once access is granted.</li>
                </ul>
                <p className="text-zinc-700 dark:text-zinc-300 leading-relaxed mt-4">
                  Service credits may be offered at our sole discretion.
                </p>
              </section>

              <section>
                <h2 className="text-2xl font-bold mt-8 mb-4 text-zinc-900 dark:text-zinc-100">5. Ownership of Content & Marketing License</h2>
                <p className="text-zinc-700 dark:text-zinc-300 leading-relaxed mb-4">
                  You retain ownership of videos and content you generate.
                </p>
                <p className="text-zinc-700 dark:text-zinc-300 leading-relaxed mb-4">
                  However, by using the Service, you grant PULSAR LTDA a:
                </p>
                <p className="text-zinc-700 dark:text-zinc-300 leading-relaxed italic bg-zinc-50 dark:bg-zinc-800 p-4 rounded-lg border border-zinc-200 dark:border-zinc-700">
                  Worldwide, perpetual, irrevocable, royalty-free license to use, reproduce, modify, display, distribute, and publish your generated content for marketing, promotional materials, case studies, demonstrations, and advertising of the Service, with or without attribution.
                </p>
                <p className="text-zinc-700 dark:text-zinc-300 leading-relaxed mt-4">
                  You may request exclusion from marketing use by emailing [SUPPORT EMAIL].
                </p>
              </section>

              <section>
                <h2 className="text-2xl font-bold mt-8 mb-4 text-zinc-900 dark:text-zinc-100">6. Acceptable Use & Prohibited Activities</h2>
                <p className="text-zinc-700 dark:text-zinc-300 leading-relaxed mb-4">
                  You may not use the Service to create or distribute:
                </p>
                <ul className="list-disc list-inside space-y-2 text-zinc-700 dark:text-zinc-300 ml-4">
                  <li>Illegal, infringing, hateful, defamatory, or explicit content</li>
                  <li>Copyright-violating material</li>
                  <li>Misleading, fraudulent, or scam content</li>
                  <li>Content that violates social platform rules</li>
                </ul>
                <p className="text-zinc-700 dark:text-zinc-300 leading-relaxed mt-4 mb-2">
                  You may not:
                </p>
                <ul className="list-disc list-inside space-y-2 text-zinc-700 dark:text-zinc-300 ml-4">
                  <li>Reverse engineer the platform</li>
                  <li>Use bots, scrapers, or automation to access the Service</li>
                  <li>Abuse system resources</li>
                  <li>Attempt unauthorized access</li>
                </ul>
                <p className="text-zinc-700 dark:text-zinc-300 leading-relaxed mt-4">
                  You are solely responsible for compliance with TikTok, Instagram, YouTube, and any other platform where content is published.
                </p>
              </section>

              <section>
                <h2 className="text-2xl font-bold mt-8 mb-4 text-zinc-900 dark:text-zinc-100">7. DMCA / Copyright Infringement Procedure</h2>
                <p className="text-zinc-700 dark:text-zinc-300 leading-relaxed mb-4">
                  If you believe content generated through our Service infringes your copyright, send a notice to:
                </p>
                <p className="text-zinc-700 dark:text-zinc-300 font-semibold mb-4">
                  [COPYRIGHT EMAIL]
                </p>
                <p className="text-zinc-700 dark:text-zinc-300 leading-relaxed mb-2">
                  Include:
                </p>
                <ul className="list-disc list-inside space-y-2 text-zinc-700 dark:text-zinc-300 ml-4">
                  <li>Your identification</li>
                  <li>Description of the copyrighted work</li>
                  <li>URL or evidence of infringement</li>
                  <li>A statement under penalty of perjury</li>
                  <li>Your signature</li>
                </ul>
                <p className="text-zinc-700 dark:text-zinc-300 leading-relaxed mt-4">
                  We may remove content and terminate repeat infringers.
                </p>
              </section>

              <section>
                <h2 className="text-2xl font-bold mt-8 mb-4 text-zinc-900 dark:text-zinc-100">8. Data Storage, Retention & Fair Use Policy</h2>
                <p className="text-zinc-700 dark:text-zinc-300 leading-relaxed mb-4">
                  We may store generated videos and assets for a limited time for operational purposes.
                </p>
                <p className="text-zinc-700 dark:text-zinc-300 leading-relaxed mb-2">
                  We reserve the right to:
                </p>
                <ul className="list-disc list-inside space-y-2 text-zinc-700 dark:text-zinc-300 ml-4">
                  <li>Delete stored media after [e.g., 90 days]</li>
                  <li>Limit excessive usage</li>
                  <li>Enforce fair use limits to protect infrastructure</li>
                </ul>
                <p className="text-zinc-700 dark:text-zinc-300 leading-relaxed mt-4">
                  You are responsible for downloading and backing up your content.
                </p>
              </section>

              <section>
                <h2 className="text-2xl font-bold mt-8 mb-4 text-zinc-900 dark:text-zinc-100">9. Third-Party Services</h2>
                <p className="text-zinc-700 dark:text-zinc-300 leading-relaxed mb-4">
                  The Service may integrate with third-party platforms. We are not responsible for:
                </p>
                <ul className="list-disc list-inside space-y-2 text-zinc-700 dark:text-zinc-300 ml-4">
                  <li>Platform bans</li>
                  <li>Algorithm changes</li>
                  <li>Content removals</li>
                  <li>API changes</li>
                </ul>
                <p className="text-zinc-700 dark:text-zinc-300 leading-relaxed mt-4">
                  Your use of those platforms is governed by their terms.
                </p>
              </section>

              <section>
                <h2 className="text-2xl font-bold mt-8 mb-4 text-zinc-900 dark:text-zinc-100">10. Disclaimer of Warranties</h2>
                <p className="text-zinc-700 dark:text-zinc-300 leading-relaxed mb-4">
                  The Service is provided "AS IS" and "AS AVAILABLE."
                </p>
                <p className="text-zinc-700 dark:text-zinc-300 leading-relaxed mb-2">
                  We do not guarantee:
                </p>
                <ul className="list-disc list-inside space-y-2 text-zinc-700 dark:text-zinc-300 ml-4">
                  <li>Uninterrupted service</li>
                  <li>Error-free operation</li>
                  <li>Specific results, views, monetization, or growth</li>
                </ul>
              </section>

              <section>
                <h2 className="text-2xl font-bold mt-8 mb-4 text-zinc-900 dark:text-zinc-100">11. Limitation of Liability</h2>
                <p className="text-zinc-700 dark:text-zinc-300 leading-relaxed mb-4">
                  To the maximum extent permitted by law:
                </p>
                <p className="text-zinc-700 dark:text-zinc-300 leading-relaxed mb-4">
                  Our total liability for any claim shall not exceed the amount you paid us in the last 12 months, or USD $100, whichever is lower.
                </p>
                <p className="text-zinc-700 dark:text-zinc-300 leading-relaxed">
                  We are not liable for indirect, incidental, or consequential damages.
                </p>
              </section>

              <section>
                <h2 className="text-2xl font-bold mt-8 mb-4 text-zinc-900 dark:text-zinc-100">12. Termination</h2>
                <p className="text-zinc-700 dark:text-zinc-300 leading-relaxed">
                  We may suspend or terminate your access at any time, with or without reason.
                </p>
                <p className="text-zinc-700 dark:text-zinc-300 leading-relaxed mt-4">
                  You may cancel your subscription at any time, but no refunds are provided.
                </p>
              </section>

              <section>
                <h2 className="text-2xl font-bold mt-8 mb-4 text-zinc-900 dark:text-zinc-100">13. Governing Law & Jurisdiction</h2>
                <p className="text-zinc-700 dark:text-zinc-300 leading-relaxed">
                  These Terms are governed by the laws of São Paulo, Brazil.
                </p>
                <p className="text-zinc-700 dark:text-zinc-300 leading-relaxed mt-4">
                  All disputes shall be subject to the exclusive jurisdiction of the courts of Brazil.
                </p>
              </section>

              <section>
                <h2 className="text-2xl font-bold mt-8 mb-4 text-zinc-900 dark:text-zinc-100">14. Changes to the Terms</h2>
                <p className="text-zinc-700 dark:text-zinc-300 leading-relaxed">
                  We may update these Terms at any time. Continued use of the Service constitutes acceptance.
                </p>
              </section>

              <section>
                <h2 className="text-2xl font-bold mt-8 mb-4 text-zinc-900 dark:text-zinc-100">15. Contact</h2>
                <p className="text-zinc-700 dark:text-zinc-300 leading-relaxed mb-4">
                  For any questions regarding these Terms:
                </p>
                <div className="space-y-2 text-zinc-700 dark:text-zinc-300">
                  <p><strong>Email:</strong> [SUPPORT EMAIL]</p>
                  <p><strong>Address:</strong> [COMPANY ADDRESS]</p>
                </div>
              </section>

            </div>
          </div>
        </div>
      </main>

      <Footer />
    </div>
  );
}
