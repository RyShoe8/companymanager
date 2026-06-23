'use client';

import React, { useState, useRef, useEffect, useLayoutEffect, useCallback } from 'react';
import { createPortal } from 'react-dom';
import { useInspectorLight, lightSurface } from '@/contexts/InspectorLightContext';

interface MultiSelectProps {
  label?: string;
  error?: string;
  options: { value: string; label: string }[];
  value: string[];
  onChange: (values: string[]) => void;
  disabled?: boolean;
  className?: string;
}

const DROPDOWN_MAX_HEIGHT = 240;
const DROPDOWN_GAP = 4;

export default function MultiSelect({
  label,
  error,
  options,
  value = [],
  onChange,
  disabled = false,
  className = '',
}: MultiSelectProps) {
  const light = useInspectorLight();
  const [isOpen, setIsOpen] = useState(false);
  const [mounted, setMounted] = useState(false);
  const [dropdownPosition, setDropdownPosition] = useState({
    top: 0,
    left: 0,
    width: 0,
    openUp: false,
  });
  const containerRef = useRef<HTMLDivElement>(null);
  const triggerRef = useRef<HTMLDivElement>(null);
  const dropdownRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    setMounted(true);
  }, []);

  const updateDropdownPosition = useCallback(() => {
    if (!triggerRef.current) return;
    const rect = triggerRef.current.getBoundingClientRect();
    const spaceBelow = window.innerHeight - rect.bottom;
    const spaceAbove = rect.top;
    const openUp = spaceBelow < DROPDOWN_MAX_HEIGHT + DROPDOWN_GAP && spaceAbove > spaceBelow;
    setDropdownPosition({
      top: openUp ? rect.top - DROPDOWN_GAP : rect.bottom + DROPDOWN_GAP,
      left: rect.left,
      width: Math.max(rect.width, 120),
      openUp,
    });
  }, []);

  useLayoutEffect(() => {
    if (!isOpen) return;
    updateDropdownPosition();
  }, [isOpen, updateDropdownPosition]);

  useEffect(() => {
    if (!isOpen) return;
    const onScrollOrResize = () => updateDropdownPosition();
    window.addEventListener('resize', onScrollOrResize);
    window.addEventListener('scroll', onScrollOrResize, true);
    return () => {
      window.removeEventListener('resize', onScrollOrResize);
      window.removeEventListener('scroll', onScrollOrResize, true);
    };
  }, [isOpen, updateDropdownPosition]);

  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      const target = event.target as Node;
      if (
        containerRef.current?.contains(target) ||
        dropdownRef.current?.contains(target)
      ) {
        return;
      }
      setIsOpen(false);
    };

    if (isOpen) {
      document.addEventListener('mousedown', handleClickOutside);
    }

    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
    };
  }, [isOpen]);

  const toggleOption = (optionValue: string) => {
    if (disabled) return;

    if (value.includes(optionValue)) {
      onChange(value.filter((v) => v !== optionValue));
    } else {
      onChange([...value, optionValue]);
    }
  };

  const selectedLabels = options
    .filter((opt) => value.includes(opt.value))
    .map((opt) => opt.label)
    .join(', ');

  const dropdown =
    isOpen && !disabled && mounted
      ? createPortal(
          <div
            ref={dropdownRef}
            className={`fixed z-[9999] ${lightSurface(
              'bg-white text-gray-900 border border-gray-300',
              'dark:bg-gray-800 dark:text-white dark:border-gray-700',
              light
            )} rounded-lg shadow-lg max-h-60 overflow-auto`}
            style={{
              top: dropdownPosition.openUp ? undefined : dropdownPosition.top,
              bottom: dropdownPosition.openUp
                ? window.innerHeight - dropdownPosition.top
                : undefined,
              left: dropdownPosition.left,
              minWidth: dropdownPosition.width,
            }}
            onMouseDown={(e) => e.stopPropagation()}
          >
            {options.length === 0 ? (
              <p
                className={`px-3 py-2 text-sm ${lightSurface('text-gray-500', 'dark:text-gray-400', light)}`}
              >
                No team members available — assign team on the client or project first
              </p>
            ) : (
              options.map((option) => (
              <label
                key={option.value}
                className={`flex items-center px-3 py-2 cursor-pointer ${lightSurface(
                  'hover:bg-gray-100',
                  'dark:hover:bg-gray-700',
                  light
                )}`}
              >
                <input
                  type="checkbox"
                  checked={value.includes(option.value)}
                  onChange={() => toggleOption(option.value)}
                  className="mr-2 rounded border-gray-300 text-blue-600 focus:ring-blue-500"
                />
                <span
                  className={`text-sm ${lightSurface('text-gray-900', 'dark:text-white', light)}`}
                >
                  {option.label}
                </span>
              </label>
            ))
            )}
          </div>,
          document.body
        )
      : null;

  return (
    <div className={`w-full relative ${className}`} ref={containerRef}>
      {label && (
        <label
          className={`block text-sm font-medium mb-1 ${lightSurface(
            'text-gray-700',
            'dark:text-gray-300',
            light
          )}`}
        >
          {label}
        </label>
      )}
      <div
        ref={triggerRef}
        className={`
          w-full px-3 py-2 border rounded-lg cursor-pointer
          focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent
          ${lightSurface(
            'bg-white text-gray-900 border-gray-300',
            'dark:bg-gray-800 dark:border-gray-700 dark:text-white',
            light
          )}
          ${error ? 'border-red-500' : ''}
          ${disabled ? 'opacity-50 cursor-not-allowed' : ''}
        `}
        onClick={() => !disabled && setIsOpen(!isOpen)}
      >
        <div className="flex items-center justify-between">
          <span
            className={
              value.length === 0
                ? lightSurface('text-gray-400', 'dark:text-gray-500', light)
                : lightSurface('text-gray-900', 'dark:text-white', light)
            }
          >
            {value.length === 0 ? 'None selected' : selectedLabels || 'None selected'}
          </span>
          <svg
            className={`w-4 h-4 shrink-0 transition-transform ${isOpen ? 'rotate-180' : ''} ${lightSurface(
              'text-gray-500',
              'dark:text-gray-400',
              light
            )}`}
            fill="none"
            stroke="currentColor"
            viewBox="0 0 24 24"
          >
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
          </svg>
        </div>
      </div>
      {dropdown}
      {error && (
        <p className={`mt-1 text-sm ${lightSurface('text-red-600', 'dark:text-red-400', light)}`}>
          {error}
        </p>
      )}
    </div>
  );
}
