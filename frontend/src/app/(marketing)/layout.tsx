import React from 'react';
import Link from 'next/link';
import { Download, LayoutGrid, LogIn } from 'lucide-react';

export default function MarketingLayout({
    children,
}: {
    children: React.ReactNode;
}) {
    return (
        <div className="flex flex-col min-h-screen">
            {/* Premium Glass Navbar */}
            <nav className="fixed w-full z-50 bg-white/10 dark:bg-black/10 backdrop-blur-lg border-b border-white/20 dark:border-white/10">
                <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
                    <div className="flex justify-between items-center h-20">
                        {/* Logo */}
                        <div className="flex items-center gap-3">
                            <div className="w-10 h-10 bg-gradient-to-tr from-blue-600 to-violet-600 rounded-xl flex items-center justify-center shadow-lg shadow-blue-500/20">
                                <span className="text-white font-bold text-xl">A</span>
                            </div>
                            <span className="font-bold text-xl tracking-tight bg-clip-text text-transparent bg-gradient-to-r from-slate-900 to-slate-700 dark:from-white dark:to-slate-300">
                                AdaptiveWeb
                            </span>
                        </div>

                        {/* Links */}
                        <div className="hidden md:flex gap-8 text-sm font-medium text-slate-600 dark:text-slate-400">
                            <Link href="/#features" className="hover:text-blue-600 dark:hover:text-white transition-colors">Features</Link>
                            <Link href="/#demo" className="hover:text-blue-600 dark:hover:text-white transition-colors">Live Demo</Link>
                            <Link href="/#pricing" className="hover:text-blue-600 dark:hover:text-white transition-colors">Pricing</Link>
                        </div>

                        {/* Actions */}
                        <div className="flex items-center gap-4">
                            <Link href="/login" className="hidden md:flex items-center gap-2 text-sm font-medium text-slate-600 dark:text-slate-300 hover:text-blue-600 dark:hover:text-white transition-colors">
                                <LogIn size={18} /> Sign In
                            </Link>
                            <Link href="/dashboard" className="bg-slate-900 dark:bg-white text-white dark:text-slate-900 px-5 py-2.5 rounded-full font-bold text-sm hover:scale-105 transition-transform shadow-lg flex items-center gap-2">
                                <LayoutGrid size={18} /> Dashboard
                            </Link>
                        </div>
                    </div>
                </div>
            </nav>

            <main className="flex-grow pt-20">
                {children}
            </main>

            {/* Footer */}
            <footer className="bg-slate-50 dark:bg-black border-t border-slate-200 dark:border-slate-800 py-12">
                <div className="max-w-7xl mx-auto px-4 text-center">
                    <p className="text-slate-500 text-sm">© 2025 AdaptiveWeb. Crafted for intelligence.</p>
                </div>
            </footer>
        </div>
    );
}
