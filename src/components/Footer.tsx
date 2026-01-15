'use client';

import Link from 'next/link';
import Image from 'next/image';

export default function Footer() {
  return (
    <footer className="bg-background-card border-t border-border mt-auto">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        <div className="grid grid-cols-1 md:grid-cols-4 gap-8">
          {/* Brand */}
          <div className="col-span-1">
            <Link href="/planning-map" className="flex items-center gap-3 mb-4">
              <Image
                src="/images/Nucleas.png"
                alt="Nucleas Logo"
                width={32}
                height={32}
                className="h-8 w-auto"
                priority
                unoptimized
              />
              <span className="text-xl font-bold text-text-primary">
                Nucleas
              </span>
            </Link>
            <p className="text-sm text-text-secondary">
              Plan and manage your company's work and assets.
            </p>
          </div>

          {/* Product */}
          <div>
            <h3 className="text-sm font-semibold text-text-primary mb-4">Product</h3>
            <ul className="space-y-2">
              <li>
                <Link href="/features/planning-map" className="text-sm text-text-secondary hover:text-primary transition-colors">
                  Planning Map
                </Link>
              </li>
              <li>
                <Link href="/features/projects" className="text-sm text-text-secondary hover:text-primary transition-colors">
                  Projects
                </Link>
              </li>
              <li>
                <Link href="/features/operations" className="text-sm text-text-secondary hover:text-primary transition-colors">
                  Operations
                </Link>
              </li>
              <li>
                <Link href="/features/assets" className="text-sm text-text-secondary hover:text-primary transition-colors">
                  Assets
                </Link>
              </li>
              <li>
                <Link href="/features/employees" className="text-sm text-text-secondary hover:text-primary transition-colors">
                  Employees
                </Link>
              </li>
            </ul>
          </div>

          {/* Company */}
          <div>
            <h3 className="text-sm font-semibold text-text-primary mb-4">Company</h3>
            <ul className="space-y-2">
              <li>
                <Link href="/about" className="text-sm text-text-secondary hover:text-primary transition-colors">
                  About Us
                </Link>
              </li>
              <li>
                <Link href="/contact" className="text-sm text-text-secondary hover:text-primary transition-colors">
                  Contact
                </Link>
              </li>
              <li>
                <Link href="/contact?type=Feature Request" className="text-sm text-text-secondary hover:text-primary transition-colors">
                  Request a Feature
                </Link>
              </li>
            </ul>
          </div>

          {/* Legal */}
          <div>
            <h3 className="text-sm font-semibold text-text-primary mb-4">Legal</h3>
            <ul className="space-y-2">
              <li>
                <Link href="/terms" className="text-sm text-text-secondary hover:text-primary transition-colors">
                  Terms of Service
                </Link>
              </li>
              <li>
                <Link href="/privacy" className="text-sm text-text-secondary hover:text-primary transition-colors">
                  Privacy Policy
                </Link>
              </li>
            </ul>
          </div>
        </div>

        <div className="mt-8 pt-8 border-t border-border">
          <div className="flex flex-col md:flex-row justify-between items-center">
            <p className="text-sm text-text-secondary">
              © 2026 Nucleas. All rights reserved. Built by{' '}
              <a
                href="https://themediashop.co"
                target="_blank"
                rel="noopener noreferrer"
                className="text-primary hover:text-primary-hover transition-colors"
              >
                TheMediaShop.co
              </a>
            </p>
            <div className="mt-4 md:mt-0 flex items-center gap-4">
              <a
                href="mailto:theteam@nucleas.app"
                className="text-sm text-text-secondary hover:text-primary transition-colors"
              >
                theteam@nucleas.app
              </a>
            </div>
          </div>
        </div>
      </div>
    </footer>
  );
}
