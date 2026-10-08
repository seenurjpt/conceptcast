import type { Metadata } from 'next';
import Link from 'next/link';
import { SITE_AUTHOR, SITE_NAME, SITE_URL } from '@/lib/site';
import { PublicPage } from '../landing/PublicPage';
import { LegalToc } from './LegalToc';

export const dynamic = 'force-static';

/**
 * The privacy policy. Every statement here describes what the code does
 * today; when data handling changes (a new provider, analytics, encryption,
 * a delete-my-data button), update this page and LAST_UPDATED with it.
 */

const LAST_UPDATED = 'October 8, 2026';
const DESCRIPTION = 'What conceptcast collects, why, who it is shared with, how long it is kept, and the choices you have.';

export const metadata: Metadata = {
  title: 'Privacy Policy',
  description: DESCRIPTION,
  alternates: { canonical: '/privacy' },
  openGraph: { type: 'website', url: '/privacy', siteName: SITE_NAME, title: `Privacy Policy · ${SITE_NAME}`, description: DESCRIPTION },
};

const SECTIONS = [
  ['who', 'Who runs conceptcast'],
  ['collect', 'What we collect'],
  ['not-collect', 'What we do not collect'],
  ['use', 'How we use it'],
  ['share', 'Who it is shared with'],
  ['cookies', 'Cookies and local storage'],
  ['security', 'How it is protected'],
  ['retention', 'How long it is kept'],
  ['choices', 'Your choices'],
  ['children', 'Children'],
  ['changes', 'Changes to this policy'],
  ['contact', 'Contact'],
] as const;

export default function PrivacyPage() {
  return (
    <PublicPage
      eyebrow="Privacy Policy"
      title="Your words, your key, your call."
      lede={
        <>
          This policy explains what {SITE_NAME} collects when you use it, why, and who it reaches. It is written to match
          what the app actually does. Last updated {LAST_UPDATED}.
        </>
      }
    >
      <div className="mx-auto max-w-[1120px] px-4 py-12 sm:px-6 sm:py-16">
        <div className="legal">
          <LegalToc sections={SECTIONS} />

          <article className="legal-body min-w-0">
            <div className="legal-summary">
              <p className="t-title-sm">The short version</p>
              <ul>
                <li>We collect what is needed to write and publish your posts: your LinkedIn sign-in, what you write, and the AI keys you add.</li>
                <li>Nothing is posted to LinkedIn unless you approve it.</li>
                <li>Your content is sent to the AI provider whose key you added, to research and write. That provider bills you directly.</li>
                <li>No analytics, no advertising, no tracking cookies, and we never sell your data.</li>
                <li>Your AI keys are encrypted. You can remove them, and sign out, at any time.</li>
              </ul>
            </div>

            <section id="who">
              <h2>1. Who runs conceptcast</h2>
              <p>
                {SITE_NAME} is an independent project built and operated by{' '}
                <a href={SITE_AUTHOR.linkedin} target="_blank" rel="noopener noreferrer">
                  {SITE_AUTHOR.name}
                </a>
                . This policy covers the website and app at <a href={SITE_URL}>{SITE_URL.replace(/^https?:\/\//, '')}</a>,
                including the public pages and the signed-in app. In this policy, &ldquo;we&rdquo; means the operator of
                this deployment, and &ldquo;you&rdquo; means the person using it.
              </p>
            </section>

            <section id="collect">
              <h2>2. What we collect</h2>
              <p>Only what the app needs to do its job, and most of it is what you give it directly.</p>
              <table className="legal-table">
                <thead>
                  <tr>
                    <th scope="col">Data</th>
                    <th scope="col">What it includes</th>
                    <th scope="col">Where it comes from</th>
                  </tr>
                </thead>
                <tbody>
                  <tr>
                    <td>LinkedIn account</td>
                    <td>
                      Your name, profile photo link and LinkedIn member ID, and the access tokens that let the app post on
                      your behalf. Your email address only if LinkedIn provides it.
                    </td>
                    <td>LinkedIn, when you sign in</td>
                  </tr>
                  <tr>
                    <td>AI provider keys</td>
                    <td>The Anthropic, OpenAI or Google Gemini keys you add, and which provider you prefer.</td>
                    <td>You, in Settings</td>
                  </tr>
                  <tr>
                    <td>Your content</td>
                    <td>
                      Topics and subtopics, drafts and their edits, posts you write in the composer, reasons you give when
                      rejecting a draft, publishing schedules, your voice notes and the writing samples you paste, and
                      example posts you save (which may be other people&rsquo;s public posts).
                    </td>
                    <td>You, and the app as it researches and writes</td>
                  </tr>
                  <tr>
                    <td>Research</td>
                    <td>Facts, quotes and the web pages they came from, gathered for each subtopic.</td>
                    <td>Public web pages and news feeds</td>
                  </tr>
                  <tr>
                    <td>Post performance</td>
                    <td>Reactions, comments, shares and impressions for posts published through the app.</td>
                    <td>LinkedIn where available, or numbers you enter</td>
                  </tr>
                  <tr>
                    <td>Usage records</td>
                    <td>
                      For each AI request: which step it was for, the provider and model, token counts, estimated cost,
                      how long it took, and whether it failed (with the error message). Not the text of the request or the
                      answer.
                    </td>
                    <td>The app, as it runs</td>
                  </tr>
                </tbody>
              </table>
            </section>

            <section id="not-collect">
              <h2>3. What we do not collect</h2>
              <ul>
                <li>No analytics, advertising or tracking scripts, and no third-party cookies.</li>
                <li>The app does not store your IP address, device or browser details, or location.</li>
                <li>It does not read your LinkedIn feed, connections or messages. At most, it reads the reaction and comment counts on posts it published for you.</li>
                <li>Fonts are served from this site, so loading a page does not contact a font service.</li>
              </ul>
              <p>
                Our hosting provider may keep standard request logs (such as IP addresses and timestamps) for a short time
                to run and secure the service. Those logs are not used to profile you.
              </p>
            </section>

            <section id="use">
              <h2>4. How we use it</h2>
              <ul>
                <li>To sign you in and keep you signed in.</li>
                <li>To research the topics you choose and draft posts in your voice.</li>
                <li>To publish the posts you approve, at the time you choose, and to refresh LinkedIn access so scheduled posts still go out.</li>
                <li>To show how your published posts perform, and to favour the angles that work for you.</li>
                <li>To show your AI spending, and to find and fix problems.</li>
              </ul>
              <p>We do not use your content to train AI models, and we do not sell or rent your data to anyone.</p>
            </section>

            <section id="share">
              <h2>5. Who it is shared with</h2>
              <h3>LinkedIn</h3>
              <p>
                To sign you in, and to publish the posts you approve (with a link-preview image when you add the optional &ldquo;Posted from conceptcast&rdquo; line). Posts on
                LinkedIn are then governed by LinkedIn&rsquo;s own terms and privacy policy.
              </p>
              <h3>The AI providers whose keys you add</h3>
              <p>
                To research and write, the app sends your provider the topic and subtopic, the research it gathered, your
                voice notes and writing samples, a few of your best-performing published posts as examples of your style,
                and, in the composer, the text you ask it to rewrite. If you add more than one key and one fails, the
                request is retried with the next, so the same content can reach more than one of your providers. Web
                searches for research are run by your provider. Each provider handles this data under its own terms, and
                bills your account directly.
              </p>
              <h3>Websites used as sources</h3>
              <p>
                The app fetches public web pages and news feeds to read them for research. These requests do not include
                anything about you.
              </p>
              <h3>Infrastructure providers</h3>
              <p>
                The app runs on a hosting platform (Vercel), keeps its data in a MongoDB database, and runs scheduled
                work (publishing, token refresh, news scans) through Inngest. These services process data only to run
                the app. Scheduled jobs carry identifiers such as your LinkedIn member ID and post IDs, not your content.
              </p>
              <h3>Nobody else</h3>
              <p>
                We share data with no one else, except where the law requires it. If the project ever changes hands, this
                policy goes with it and you will be told.
              </p>
            </section>

            <section id="cookies">
              <h2>6. Cookies and local storage</h2>
              <p>The app uses a few strictly necessary cookies, and your browser&rsquo;s local storage for preferences. None of them track you.</p>
              <table className="legal-table">
                <thead>
                  <tr>
                    <th scope="col">Name</th>
                    <th scope="col">Purpose</th>
                    <th scope="col">Kept for</th>
                  </tr>
                </thead>
                <tbody>
                  <tr>
                    <td>
                      <code>cc_session</code>
                    </td>
                    <td>Keeps you signed in. A signed timestamp with no personal data, unreadable by page scripts.</td>
                    <td>30 days, or until you sign out</td>
                  </tr>
                  <tr>
                    <td>
                      <code>li_oauth_state</code>, <code>li_oauth_return</code>
                    </td>
                    <td>Protect the LinkedIn sign-in from forgery, and remember which page to return you to.</td>
                    <td>10 minutes, removed after sign-in</td>
                  </tr>
                  <tr>
                    <td>Local storage</td>
                    <td>
                      Your preferences and work in progress, kept only in your browser: light or dark theme, sidebar
                      state, recent searches, the post you are writing in the composer, watermark choice, and a few
                      dismissed tips.
                    </td>
                    <td>Until you clear your browser data</td>
                  </tr>
                </tbody>
              </table>
            </section>

            <section id="security">
              <h2>7. How it is protected</h2>
              <ul>
                <li>The site is served over HTTPS.</li>
                <li>
                  Your AI keys are encrypted before they are stored (AES-256-GCM), and the app only ever shows their last
                  four characters.
                </li>
                <li>The sign-in cookie is signed so it cannot be forged, and is not readable by scripts on the page.</li>
                <li>LinkedIn tokens are kept in the app&rsquo;s database, which only the app&rsquo;s server can reach.</li>
              </ul>
              <p>
                No system is perfectly secure. If we learn of a breach that affects your data, we will tell you as soon as
                we can.
              </p>
            </section>

            <section id="retention">
              <h2>8. How long it is kept</h2>
              <ul>
                <li>Your content, research, post history and usage records are kept until they are deleted, so your history stays available.</li>
                <li>Signing out deletes your LinkedIn connection (name, photo, member details and tokens) from the app.</li>
                <li>Removing an AI key in Settings deletes it.</li>
                <li>Scheduled posts can be unscheduled, and saved example posts deleted, from within the app.</li>
                <li>
                  To have everything else deleted (drafts, topics, voice samples and usage records), contact us and we
                  will remove it.
                </li>
              </ul>
              <p>Posts already published live on LinkedIn; delete them there if you want them gone.</p>
            </section>

            <section id="choices">
              <h2>9. Your choices</h2>
              <ul>
                <li>
                  <strong>See and change your data.</strong> Your topics, drafts, voice and settings are all visible and
                  editable in the app.
                </li>
                <li>
                  <strong>Stop sending data to an AI provider.</strong> Remove its key in Settings.
                </li>
                <li>
                  <strong>Disconnect LinkedIn.</strong> Sign out from the account menu, and you can also remove
                  conceptcast from the apps permitted in your LinkedIn settings.
                </li>
                <li>
                  <strong>Ask for a copy or deletion.</strong> Contact us and we will respond within 30 days. Depending on
                  where you live, you may have further rights over your data; contact us to use them.
                </li>
              </ul>
            </section>

            <section id="children">
              <h2>10. Children</h2>
              <p>
                {SITE_NAME} is not meant for children. You need a LinkedIn account to use it, and we do not knowingly
                collect data from anyone under 16.
              </p>
            </section>

            <section id="changes">
              <h2>11. Changes to this policy</h2>
              <p>
                If what the app collects or who it shares data with changes, this page will be updated first and the date
                at the top will change.
              </p>
            </section>

            <section id="contact">
              <h2>12. Contact</h2>
              <p>
                Questions, requests for a copy of your data, or deletion requests: message {SITE_AUTHOR.name} on{' '}
                <a href={SITE_AUTHOR.linkedin} target="_blank" rel="noopener noreferrer">
                  LinkedIn
                </a>{' '}
                (the quickest way), or get in touch through{' '}
                <a href={SITE_AUTHOR.url} target="_blank" rel="noopener noreferrer">
                  GitHub
                </a>
                .
              </p>
              <p>
                <Link href="/about">Read more about {SITE_NAME}</Link>
              </p>
            </section>
          </article>
        </div>
      </div>
    </PublicPage>
  );
}
