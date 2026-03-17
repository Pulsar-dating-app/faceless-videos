"use client";

import { Navbar } from "@/components/Navbar";
import { Footer } from "@/components/Footer";

export default function PrivacyPolicyPage() {
  return (
    <div className="min-h-screen bg-background text-foreground flex flex-col">
      <Navbar />

      {/* Main Content */}
      <main className="flex-1 px-4 py-12 sm:py-20">
        <div className="max-w-4xl mx-auto space-y-8">
          {/* Header */}
          <div className="text-center space-y-4 mb-12">
            <h1 className="text-4xl sm:text-5xl font-extrabold tracking-tight">
              Privacy Policy
            </h1>
            <p className="text-lg text-zinc-600 dark:text-zinc-400">
              Last updated: March 17, 2026
            </p>
          </div>

          {/* Privacy Policy Content */}
          <div className="prose prose-zinc dark:prose-invert max-w-none">
            <div className="bg-white dark:bg-zinc-900 rounded-2xl border border-zinc-200 dark:border-zinc-800 shadow-xl p-8 sm:p-12 space-y-8">

              <section>
                <h2 className="text-2xl font-bold mt-8 mb-4 text-zinc-900 dark:text-zinc-100 first:mt-0">1. Who is the Controller?</h2>
                <p className="text-zinc-700 dark:text-zinc-300 leading-relaxed mb-4">
                  This Privacy Policy applies specifically to the application Viral Faceless Reels.
                </p>
                <p className="text-zinc-700 dark:text-zinc-300 leading-relaxed mb-4">We are:</p>
                <div className="space-y-2 text-zinc-700 dark:text-zinc-300">
                  <p><strong>Company name:</strong> PULSAR LTDA</p>
                  <p><strong>Registered address:</strong> Rua Santa Maria, 90, Capivari, São Paulo, Brazil</p>
                  <p><strong>Company ID / Tax ID:</strong> 58.261.994/0001-80</p>
                  <p><strong>Email:</strong> info@viralfacelessreels.com</p>
                </div>
                <p className="mt-4 text-zinc-700 dark:text-zinc-300 leading-relaxed">
                  We act as the data controller, determining how and why your personal data is processed.
                </p>
              </section>

              <section>
                <h2 className="text-2xl font-bold mt-8 mb-4 text-zinc-900 dark:text-zinc-100">2. Age Requirements</h2>
                <p className="text-zinc-700 dark:text-zinc-300 leading-relaxed mb-2">
                  Viral Faceless Reels is intended for users aged 18 and older.
                </p>
                <p className="text-zinc-700 dark:text-zinc-300 leading-relaxed mb-2">
                  If you are under 18, you may only use the App with parental consent.
                </p>
                <p className="text-zinc-700 dark:text-zinc-300 leading-relaxed">
                  By using Viral Faceless Reels, you confirm that you are over 18 or have appropriate consent.
                </p>
              </section>

              <section>
                <h2 className="text-2xl font-bold mt-8 mb-4 text-zinc-900 dark:text-zinc-100">3. Categories of Personal Data We Process</h2>
                <p className="text-zinc-700 dark:text-zinc-300 leading-relaxed mb-4">
                  When you use Viral Faceless Reels, we may process the following categories of personal data:
                </p>
                <ul className="list-disc list-inside space-y-2 text-zinc-700 dark:text-zinc-300 ml-4">
                  <li><strong>Identity Data:</strong> Email, name</li>
                  <li><strong>Payment Data:</strong> Billing information, payment method details (processed by Stripe)</li>
                  <li><strong>Technical Data:</strong> IP address, browser, device, usage logs</li>
                  <li><strong>Social Media Data:</strong> OAuth tokens, account IDs, profile data from connected platforms (including TikTok, YouTube, Instagram)</li>
                  <li><strong>Usage Data:</strong> Subscription plan, number of generated series</li>
                  <li><strong>Communications Data:</strong> Emails, support messages</li>
                </ul>

                <h3 className="text-xl font-semibold mt-6 mb-3 text-zinc-900 dark:text-zinc-100">Payment Processing</h3>
                <p className="text-zinc-700 dark:text-zinc-300 leading-relaxed">
                  We use Stripe as our third-party payment processor. We do not collect, store, or have access to your credit card details or other sensitive financial information. All payment information is collected and processed directly by Stripe in accordance with Stripe&apos;s Privacy Policy.
                </p>
              </section>

              <section>
                <h2 className="text-2xl font-bold mt-8 mb-4 text-zinc-900 dark:text-zinc-100">4. Purpose of Processing</h2>

                <h3 className="text-xl font-semibold mt-6 mb-3 text-zinc-900 dark:text-zinc-100">Service Provision (Contract Performance)</h3>
                <ul className="list-disc list-inside space-y-2 text-zinc-700 dark:text-zinc-300 ml-4 mb-4">
                  <li>Provide AI video generation</li>
                  <li>Publish videos to connected social platforms such as TikTok, YouTube, and Instagram</li>
                  <li>Maintain and manage your account</li>
                </ul>

                <h3 className="text-xl font-semibold mt-6 mb-3 text-zinc-900 dark:text-zinc-100">Social Media Integration (TikTok, YouTube, Instagram)</h3>
                <p className="text-zinc-700 dark:text-zinc-300 leading-relaxed mb-2">
                  If you connect your TikTok account to Viral Faceless Reels, we may access and use certain authorized data (such as account ID, profile information, and access tokens) solely to enable video publishing and platform integration features.
                </p>

                <h3 className="text-xl font-semibold mt-6 mb-3 text-zinc-900 dark:text-zinc-100">Testimonials &amp; Social Proof</h3>
                <p className="text-zinc-700 dark:text-zinc-300 leading-relaxed mb-4">
                  We may display anonymized profile images for social proof without names or identifying information.
                </p>

                <h3 className="text-xl font-semibold mt-6 mb-3 text-zinc-900 dark:text-zinc-100">AI-Powered Services</h3>
                <p className="text-zinc-700 dark:text-zinc-300 leading-relaxed mb-2">
                  We use service usage data and preferences to improve our AI video generation capabilities.
                </p>
                <p className="text-zinc-700 dark:text-zinc-300 leading-relaxed mb-2">
                  We do NOT use your personal data to train external AI models.
                </p>
                <p className="text-zinc-700 dark:text-zinc-300 leading-relaxed">
                  Our AI systems do not make automated decisions that significantly affect your legal rights.
                </p>
              </section>

              <section>
                <h2 className="text-2xl font-bold mt-8 mb-4 text-zinc-900 dark:text-zinc-100">5. Data Retention</h2>
                <p className="text-zinc-700 dark:text-zinc-300 leading-relaxed mb-4">
                  We retain personal data in Viral Faceless Reels as follows:
                </p>
                <div className="overflow-x-auto">
                  <table className="w-full border-collapse border border-zinc-200 dark:border-zinc-700 rounded-lg overflow-hidden">
                    <thead>
                      <tr className="bg-zinc-100 dark:bg-zinc-800">
                        <th className="border border-zinc-200 dark:border-zinc-700 px-4 py-3 text-left text-zinc-900 dark:text-zinc-100 font-semibold">Data Type</th>
                        <th className="border border-zinc-200 dark:border-zinc-700 px-4 py-3 text-left text-zinc-900 dark:text-zinc-100 font-semibold">Retention</th>
                      </tr>
                    </thead>
                    <tbody className="text-zinc-700 dark:text-zinc-300">
                      <tr>
                        <td className="border border-zinc-200 dark:border-zinc-700 px-4 py-3">Account Data</td>
                        <td className="border border-zinc-200 dark:border-zinc-700 px-4 py-3">Until deletion</td>
                      </tr>
                      <tr>
                        <td className="border border-zinc-200 dark:border-zinc-700 px-4 py-3">Social Tokens</td>
                        <td className="border border-zinc-200 dark:border-zinc-700 px-4 py-3">Until you disconnect the account</td>
                      </tr>
                      <tr>
                        <td className="border border-zinc-200 dark:border-zinc-700 px-4 py-3">Usage Logs</td>
                        <td className="border border-zinc-200 dark:border-zinc-700 px-4 py-3">24 hours</td>
                      </tr>
                      <tr>
                        <td className="border border-zinc-200 dark:border-zinc-700 px-4 py-3">Generated Content</td>
                        <td className="border border-zinc-200 dark:border-zinc-700 px-4 py-3">Less than 24 hours</td>
                      </tr>
                    </tbody>
                  </table>
                </div>
                <p className="text-zinc-700 dark:text-zinc-300 leading-relaxed mt-4">
                  You are responsible for backing up your generated videos.
                </p>
              </section>

              <section>
                <h2 className="text-2xl font-bold mt-8 mb-4 text-zinc-900 dark:text-zinc-100">6. International Data Transfers</h2>
                <p className="text-zinc-700 dark:text-zinc-300 leading-relaxed mb-2">
                  Your data may be transferred and processed outside your country of residence, including the United States and other jurisdictions where our service providers operate.
                </p>
              </section>

              <section>
                <h2 className="text-2xl font-bold mt-8 mb-4 text-zinc-900 dark:text-zinc-100">7. Use of YouTube / Google API Services</h2>
                <p className="text-zinc-700 dark:text-zinc-300 leading-relaxed mb-2">
                  If you connect YouTube to Viral Faceless Reels:
                </p>
                <ul className="list-disc list-inside space-y-2 text-zinc-700 dark:text-zinc-300 ml-4 mb-4">
                  <li>We store OAuth tokens to publish scheduled videos</li>
                  <li>You may revoke access at any time</li>
                  <li>You agree to YouTube Terms of Service</li>
                  <li>Google Privacy Policy applies</li>
                </ul>

                <h3 className="text-xl font-semibold mt-6 mb-3 text-zinc-900 dark:text-zinc-100">Google User Data Commitments</h3>
                <ul className="list-disc list-inside space-y-2 text-zinc-700 dark:text-zinc-300 ml-4">
                  <li>We only access email, name, avatar, and YouTube channel information</li>
                  <li>We do NOT use Google data for AI/ML training</li>
                  <li>We do NOT sell or use Google data for advertising</li>
                  <li>We comply with Google API Services User Data Policy</li>
                </ul>
              </section>

              <section>
                <h2 className="text-2xl font-bold mt-8 mb-4 text-zinc-900 dark:text-zinc-100">8. Data Security</h2>
                <p className="text-zinc-700 dark:text-zinc-300 leading-relaxed">
                  We implement appropriate technical and organizational measures to protect your personal data against unauthorized access, loss, or misuse.
                </p>
              </section>

              <section>
                <h2 className="text-2xl font-bold mt-8 mb-4 text-zinc-900 dark:text-zinc-100">9. Sharing Data with Third Parties (Processors)</h2>
                <p className="text-zinc-700 dark:text-zinc-300 leading-relaxed mb-4">
                  We only share data with trusted service providers necessary to operate Viral Faceless Reels:
                </p>
                <ul className="list-disc list-inside space-y-2 text-zinc-700 dark:text-zinc-300 ml-4 mb-4">
                  <li><strong>Vercel</strong> – Hosting</li>
                  <li><strong>Supabase</strong> – Database</li>
                  <li><strong>Stripe</strong> – Payments</li>
                  <li><strong>Hostinger</strong> – Email services</li>
                  <li><strong>TikTok, YouTube, Instagram APIs</strong> – Content publishing</li>
                </ul>
                <p className="text-zinc-700 dark:text-zinc-300 leading-relaxed">
                  All processors adhere to GDPR-level security standards.
                </p>
              </section>

              <section>
                <h2 className="text-2xl font-bold mt-8 mb-4 text-zinc-900 dark:text-zinc-100">10. Your Rights Under GDPR</h2>
                <p className="text-zinc-700 dark:text-zinc-300 leading-relaxed mb-4">
                  You have the right to:
                </p>
                <ul className="list-disc list-inside space-y-2 text-zinc-700 dark:text-zinc-300 ml-4 mb-4">
                  <li>Access your personal data</li>
                  <li>Correct inaccurate data</li>
                  <li>Restrict or object to processing</li>
                  <li>Request data portability</li>
                  <li>Request deletion (&quot;Right to be forgotten&quot;)</li>
                  <li>File a complaint with a data protection authority</li>
                </ul>
                <p className="text-zinc-700 dark:text-zinc-300 leading-relaxed mb-2">
                  To exercise your rights, contact: <strong>info@viralfacelessreels.com</strong>
                </p>
                <p className="text-zinc-700 dark:text-zinc-300 leading-relaxed">
                  We respond within 30 days.
                </p>
              </section>

              <section>
                <h2 className="text-2xl font-bold mt-8 mb-4 text-zinc-900 dark:text-zinc-100">11. Changes to This Policy</h2>
                <p className="text-zinc-700 dark:text-zinc-300 leading-relaxed mb-2">
                  We may update this Privacy Policy from time to time.
                </p>
                <p className="text-zinc-700 dark:text-zinc-300 leading-relaxed">
                  Continued use of Viral Faceless Reels constitutes acceptance of any updates.
                </p>
              </section>

              <section>
                <h2 className="text-2xl font-bold mt-8 mb-4 text-zinc-900 dark:text-zinc-100">12. Contact</h2>
                <p className="text-zinc-700 dark:text-zinc-300 leading-relaxed">
                  <strong>Email:</strong> info@viralfacelessreels.com
                </p>
              </section>

            </div>
          </div>
        </div>
      </main>

      <Footer />
    </div>
  );
}
