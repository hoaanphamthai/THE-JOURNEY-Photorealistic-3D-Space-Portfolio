/** Fills DOM from content.ts: hero text, bio, stats, project list, skills, socials, email. */
import { content } from '../config/content';
import { $, el } from '../utils/dom';

export function hydrate() {
  document.title = content.seo.title;
  const brandEl = document.querySelector<HTMLElement>('.hud__brand');
  if (brandEl) brandEl.textContent = content.brand;

  // Nav links
  const navEl = document.querySelector<HTMLElement>('.hud__nav');
  if (navEl && content.navigation?.length) {
    navEl.textContent = '';
    content.navigation.forEach((n) => {
      navEl.append(el('a', { href: `#${n.id}`, 'data-magnetic': '', text: n.label }));
    });
  }

  // Hero section
  $('#hero-name').textContent = content.name;
  $('#hero-role').textContent = content.role;
  $('#hero-tagline').textContent = content.tagline;
  const heroEyebrow = document.querySelector<HTMLElement>('#hero .eyebrow');
  if (heroEyebrow) heroEyebrow.textContent = content.sections.hero.eyebrow;
  const heroScroll = document.querySelector<HTMLElement>('#hero .scroll-hint');
  if (heroScroll) heroScroll.textContent = content.sections.hero.scrollHint;

  // About section
  const aboutEyebrow = document.querySelector<HTMLElement>('#about .eyebrow');
  if (aboutEyebrow) aboutEyebrow.textContent = content.sections.about.eyebrow;
  const aboutHeading = document.querySelector<HTMLElement>('#about .heading');
  if (aboutHeading) aboutHeading.textContent = content.sections.about.heading;
  const bio = $('#bio');
  bio.textContent = '';
  content.bio.forEach((p) => bio.append(el('p', { text: p })));

  const stats = $('#stats');
  stats.textContent = '';
  content.stats.forEach((s) =>
    stats.append(el('div', { class: 'stat reveal', 'data-tilt': '' }, [
      el('span', { class: 'stat__v', text: s.value }),
      el('span', { class: 'stat__k mono', text: s.label }),
    ])),
  );

  // Projects section
  const projEyebrow = document.querySelector<HTMLElement>('#projects .eyebrow');
  if (projEyebrow) projEyebrow.textContent = content.sections.projects.eyebrow;
  const projHeading = document.querySelector<HTMLElement>('#projects .heading');
  if (projHeading) projHeading.textContent = content.sections.projects.heading;
  const projLede = document.querySelector<HTMLElement>('#projects .lede');
  if (projLede) projLede.textContent = content.sections.projects.lede;

  const list = $('#project-list');
  list.textContent = '';
  content.projects.forEach((p, i) =>
    list.append(el('li', { class: 'project reveal', 'data-project': String(i) }, [
      el('button', { type: 'button', 'data-project-open': String(i), 'data-cursor': content.ui.cursorView }, [
        el('span', { class: 'project__n mono', text: String(i + 1).padStart(2, '0') }),
        el('span', { class: 'project__t', text: p.title }),
        el('span', { class: 'project__c mono', text: p.year }),
      ]),
    ])),
  );

  // Skills section
  const skillEyebrow = document.querySelector<HTMLElement>('#skills .eyebrow');
  if (skillEyebrow) skillEyebrow.textContent = content.sections.skills.eyebrow;
  const skillHeading = document.querySelector<HTMLElement>('#skills .heading');
  if (skillHeading) skillHeading.textContent = content.sections.skills.heading;

  const skills = $('#skill-list');
  skills.textContent = '';
  content.skills.forEach((s, i) => skills.append(el('li', { 'data-skill': String(i), tabindex: '0', text: s.name })));
  const labels = $('#skill-labels');
  labels.textContent = '';
  content.skills.forEach((s, i) => labels.append(el('span', { class: 'skill-label', 'data-skill-label': String(i), text: s.name })));

  // Contact section
  const contactEyebrow = document.querySelector<HTMLElement>('#contact .eyebrow');
  if (contactEyebrow) contactEyebrow.textContent = content.sections.contact.eyebrow;
  const contactHeading = document.querySelector<HTMLElement>('#contact .heading');
  if (contactHeading) contactHeading.textContent = content.sections.contact.heading;
  const copyOk = document.querySelector<HTMLElement>('#copy-email .cta__ok');
  if (copyOk) copyOk.textContent = content.sections.contact.copiedBadge;

  $('#copy-email-text').textContent = content.email;
  const socials = $('#socials');
  socials.textContent = '';
  content.socials.forEach((s) =>
    socials.append(el('li', {}, [el('a', { href: s.url, target: '_blank', rel: 'noopener noreferrer', 'data-magnetic': '', text: s.label })])),
  );

  const footerP = document.querySelector<HTMLElement>('.footer p');
  if (footerP) footerP.textContent = content.sections.contact.footerCredit;

  // UI labels
  const teleRangeK = document.querySelector<HTMLElement>('#tele-range-k');
  if (teleRangeK) teleRangeK.textContent = content.ui.telemetry.rangeLabel;
  const teleVelK = document.querySelector<HTMLElement>('#tele-vel-k');
  if (teleVelK) teleVelK.textContent = content.ui.telemetry.velocityLabel;
  const teleLocK = document.querySelector<HTMLElement>('#tele-loc-k');
  if (teleLocK) teleLocK.textContent = content.ui.telemetry.locationLabel;
  const skipMain = document.querySelector<HTMLElement>('a.skip[href="#main"]');
  if (skipMain) skipMain.textContent = content.ui.skipToContent;
  const skip3d = document.querySelector<HTMLElement>('#skip3d');
  if (skip3d) skip3d.textContent = content.ui.skip3d;
}
