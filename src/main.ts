import { mountProductCatalog } from './scenes/catalog/mount';
import { initAnalytics } from './telemetry/analytics';
import { mountClientShowcase } from './ui/carousel';
import { mountWhatsAppHandoff } from './ui/handoff';
import { mountQuickQuote } from './ui/quick-quote';
import { mountStory } from './ui/story';
import { updateYears } from './ui/years';

function bindMobileMenu(): void {
  const menu = document.querySelector<HTMLDetailsElement>('.nav-m');
  if (!menu) return;
  for (const link of menu.querySelectorAll('a')) {
    link.addEventListener('click', () => {
      menu.open = false;
    });
  }
}

updateYears();
bindMobileMenu();
mountStory();
mountProductCatalog();
mountClientShowcase();
mountQuickQuote(__SITE__.whatsapp);
mountWhatsAppHandoff();
initAnalytics();
