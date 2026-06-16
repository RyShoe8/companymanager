import Link from 'next/link';
import Button from '@/components/ui/Button';

export function EnterprisePricingCard() {
  return (
    <div className="relative flex w-full flex-col overflow-hidden rounded-lg border border-slate-200/80 bg-white text-gray-900 shadow-float ring-1 ring-black/5 transition-all duration-300 hover:-translate-y-1 hover:shadow-ring">
      <div className="flex flex-1 flex-col gap-5 p-6 pt-6">
        <div className="space-y-3 text-center">
          <h3 className="text-xl font-semibold text-gray-900">Enterprise</h3>
          <p className="text-base font-medium text-gray-800 px-2">
            Custom seat counts, dedicated support, and tailored onboarding for larger teams.
          </p>
        </div>
        <div className="text-center">
          <p className="text-4xl font-semibold tracking-tight text-gray-900">Let&apos;s talk</p>
          <p className="mt-2 text-base font-medium text-gray-900">Custom pricing</p>
          <p className="mt-0.5 text-sm text-gray-600">Built for your organization</p>
        </div>
        <ul className="space-y-2.5 text-sm text-gray-600">
          <li className="flex items-start gap-2.5">
            <span className="mt-0.5 text-primary" aria-hidden>
              ✓
            </span>
            <span>Everything in our plans, plus custom terms</span>
          </li>
          <li className="flex items-start gap-2.5">
            <span className="mt-0.5 text-primary" aria-hidden>
              ✓
            </span>
            <span>Dedicated onboarding and support</span>
          </li>
          <li className="flex items-start gap-2.5">
            <span className="mt-0.5 text-primary" aria-hidden>
              ✓
            </span>
            <span>Volume seat pricing</span>
          </li>
        </ul>
      </div>
      <div className="flex flex-col gap-2 p-6 pt-0 mt-auto">
        <Link href="/book-call" className="block w-full">
          <Button className="w-full">Book a call</Button>
        </Link>
        <Link
          href="/contact?type=Enterprise&subject=Enterprise%20inquiry"
          className="block w-full"
        >
          <Button variant="secondary" className="w-full">
            Send email
          </Button>
        </Link>
      </div>
    </div>
  );
}
