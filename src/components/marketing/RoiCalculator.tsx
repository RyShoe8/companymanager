'use client';

import { useState } from 'react';

const HOURS_SAVED_PER_PERSON_PER_PROJECT = 5;

export default function RoiCalculator() {
  const [teamSize, setTeamSize] = useState(5);
  const [projects, setProjects] = useState(10);

  // Nucleas saves roughly 5 hours per team member per project monthly
  const hoursSavedPerMonth = teamSize * projects * HOURS_SAVED_PER_PERSON_PER_PROJECT;

  return (
    <div className="bg-background-card border border-border rounded-3xl p-8 shadow-2xl relative overflow-hidden">
      <div className="absolute top-0 left-0 w-full h-1 bg-gradient-to-r from-primary via-accent to-nucleas-fourth" />
      
      <div className="grid md:grid-cols-2 gap-12 items-center">
        <div>
          <h3 className="text-2xl font-bold text-text-primary mb-6">Calculate Your Time Savings</h3>
          
          <div className="space-y-6">
            <div>
              <div className="flex justify-between mb-2">
                <label className="text-sm font-medium text-text-secondary">Team Size</label>
                <span className="text-sm font-bold text-primary">{teamSize} {teamSize === 1 ? 'person' : 'people'}</span>
              </div>
              <input 
                type="range" 
                min="1" 
                max="50" 
                value={teamSize} 
                onChange={(e) => setTeamSize(parseInt(e.target.value))}
                className="w-full h-2 bg-background-elevated rounded-lg appearance-none cursor-pointer accent-primary"
              />
            </div>

            <div>
              <div className="flex justify-between mb-2">
                <label className="text-sm font-medium text-text-secondary">Active Projects per Month</label>
                <span className="text-sm font-bold text-accent">{projects} projects</span>
              </div>
              <input 
                type="range" 
                min="1" 
                max="100" 
                value={projects} 
                onChange={(e) => setProjects(parseInt(e.target.value))}
                className="w-full h-2 bg-background-elevated rounded-lg appearance-none cursor-pointer accent-accent"
              />
            </div>
            <p className="text-xs text-text-muted pt-2 leading-relaxed">
              *Based on user data: Teams save an average of 5 hours per team member per active project each month through centralized assets, automated updates, and AI efficiency.
            </p>
          </div>
        </div>

        <div className="bg-background-elevated rounded-2xl p-8 text-center border border-white/5 relative">
          <div className="absolute inset-0 bg-gradient-to-br from-primary/5 to-accent/5 rounded-2xl pointer-events-none" />
          <h4 className="text-lg font-semibold text-text-secondary mb-2 relative z-10">Time Reclaimed Monthly</h4>
          <div className="text-5xl font-black text-white mb-2 tracking-tight relative z-10 flex items-baseline justify-center gap-2">
            {hoursSavedPerMonth.toLocaleString()} <span className="text-2xl text-text-secondary font-medium">hours</span>
          </div>
          <div className="text-primary font-medium relative z-10">
            Across your team of {teamSize}
          </div>
          <div className="mt-8 relative z-10">
            <a href="/register" className="inline-flex w-full justify-center items-center px-6 py-3 rounded-xl bg-primary text-nucleas-ink font-semibold hover:bg-primary-hover transition-colors shadow-lg shadow-primary/20">
              Start Free Trial
            </a>
          </div>
        </div>
      </div>
    </div>
  );
}
