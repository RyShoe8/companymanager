import MarketingFaq from '@/components/marketing/MarketingFaq';
import { FAQ_DATA } from '@/data/faq';

export default function HomeFAQ() {
  return (
    <MarketingFaq
      id="faq"
      badge="FAQ"
      heading="Questions & answers"
      subtitle="Everything you need to know about Nucleas."
      items={FAQ_DATA}
      variant="dark"
    />
  );
}
