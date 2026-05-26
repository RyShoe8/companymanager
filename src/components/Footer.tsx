'use client';

import Link from 'next/link';

export default function Footer() {
  return (
    <footer className="bg-background border-t border-white/10 mt-auto">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-12 md:py-16">
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-5 gap-10 lg:gap-8">
          {/* Brand */}
          <div className="lg:col-span-2">
            <Link href="/" className="flex items-center gap-3 mb-4">
              <span className="inline-flex rounded-lg bg-white px-3 py-2 shadow-sm ring-1 ring-black/5">
                <img
                  src="/images/nucleas-logo-legacy.png?v=1"
                  alt="Nucleas Logo"
                  width={140}
                  height={48}
                  className="h-10 w-auto object-contain"
                />
              </span>
            </Link>
            <p className="text-slate-400 text-sm leading-relaxed max-w-xs mb-6">
              The operating system for planning, building, and running every project you own. One command center for your entire internet business.
            </p>
          </div>

          {/* Plan / Build / Run */}
          <div>
            <h3 className="text-sm font-semibold text-white uppercase tracking-wider mb-4">Product</h3>
            <ul className="space-y-3">
              <li>
                <Link href="/plan" className="text-sm text-slate-400 hover:text-white transition-colors">
                  Plan
                </Link>
              </li>
              <li>
                <Link href="/build" className="text-sm text-slate-400 hover:text-white transition-colors">
                  Build
                </Link>
              </li>
              <li>
                <Link href="/run" className="text-sm text-slate-400 hover:text-white transition-colors">
                  Run
                </Link>
              </li>
              <li>
                <Link href="/pricing" className="text-sm text-slate-400 hover:text-white transition-colors">
                  Pricing
                </Link>
              </li>
              <li>
                <Link href="/register" className="text-sm text-primary hover:text-primary-light transition-colors font-medium">
                  Get started
                </Link>
              </li>
            </ul>
          </div>

          {/* Features */}
          <div>
            <h3 className="text-sm font-semibold text-white uppercase tracking-wider mb-4">Features</h3>
            <ul className="space-y-3">
              <li>
                <Link href="/features/planning-map" className="text-sm text-slate-400 hover:text-white transition-colors">
                  Planning Map
                </Link>
              </li>
              <li>
                <Link href="/features/projects" className="text-sm text-slate-400 hover:text-white transition-colors">
                  Projects & Tasks
                </Link>
              </li>
              <li>
                <Link href="/features/assets" className="text-sm text-slate-400 hover:text-white transition-colors">
                  Assets
                </Link>
              </li>
              <li>
                <Link href="/features/employees" className="text-sm text-slate-400 hover:text-white transition-colors">
                  Team
                </Link>
              </li>
            </ul>
          </div>

          {/* Company */}
          <div>
            <h3 className="text-sm font-semibold text-white uppercase tracking-wider mb-4">Company</h3>
            <ul className="space-y-3">
              <li>
                <Link href="/about" className="text-sm text-slate-400 hover:text-white transition-colors">
                  About
                </Link>
              </li>
              <li>
                <Link href="/contact" className="text-sm text-slate-400 hover:text-white transition-colors">
                  Contact
                </Link>
              </li>
              <li>
                <Link href="/contact?type=Feature Request" className="text-sm text-slate-400 hover:text-white transition-colors">
                  Request a Feature
                </Link>
              </li>
              <li>
                <Link href="/terms" className="text-sm text-slate-400 hover:text-white transition-colors">
                  Terms
                </Link>
              </li>
              <li>
                <Link href="/privacy" className="text-sm text-slate-400 hover:text-white transition-colors">
                  Privacy
                </Link>
              </li>
            </ul>
          </div>
        </div>

        <div className="mt-12 pt-8 border-t border-white/10">
          <div className="flex flex-col md:flex-row justify-between items-center gap-4">
            <p className="text-sm text-slate-500">
              © {new Date().getFullYear()} Nucleas. All rights reserved. Built by{' '}
              <a
                href="https://themediashop.co"
                target="_blank"
                rel="noopener noreferrer"
                className="text-slate-400 hover:text-white transition-colors"
              >
                TheMediaShop.co
              </a>
            </p>
            <a
              href="mailto:theteam@nucleas.app"
              className="text-sm text-slate-500 hover:text-slate-400 transition-colors"
            >
              theteam@nucleas.app
            </a>
          </div>
        </div>
      </div>
    </footer>
  );
}
