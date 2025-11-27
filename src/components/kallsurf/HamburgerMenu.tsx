import { useState } from 'react';
import { createPortal } from 'react-dom';
import { useNavigate } from 'react-router-dom';
import { Menu, X } from 'lucide-react';

interface MenuItem {
    label: string;
    path: string;
    description?: string;
}

const menuItems: MenuItem[] = [
    { label: 'Kallsurf Home', path: '/', description: 'Ny surfvy' },
    { label: 'Classic View', path: '/classic', description: 'Daglig vy' },
    { label: 'Multi-modell', path: '/home', description: 'Alla prognosmodeller' },
    { label: 'Live Wind', path: '/now', description: 'Realtidsvy' },
    { label: 'Diagram', path: '/chart', description: 'Avancerad graf' },
    { label: 'Experiment', path: '/experiments', description: 'Testa nya features' },
];

export function HamburgerMenu() {
    const [isOpen, setIsOpen] = useState(false);
    const navigate = useNavigate();

    const handleNavigate = (path: string) => {
        navigate(path);
        setIsOpen(false);
    };

    return (
        <>
            {/* Hamburger Button */}
            <button
                onClick={() => setIsOpen(!isOpen)}
                className="p-2 rounded-lg bg-emerald-800/40 hover:bg-emerald-700/60 transition-colors border border-emerald-600/30"
                aria-label="Meny"
            >
                {isOpen ? (
                    <X size={24} className="text-emerald-200" />
                ) : (
                    <Menu size={24} className="text-emerald-200" />
                )}
            </button>

            {/* Menu Overlay - rendered in portal */}
            {isOpen && createPortal(
                <>
                    {/* Backdrop */}
                    <div
                        className="fixed inset-0 bg-black/70 backdrop-blur-sm"
                        style={{ zIndex: 999998 }}
                        onClick={() => setIsOpen(false)}
                    />

                    {/* Menu Panel */}
                    <div
                        className="fixed top-0 right-0 h-full w-80 max-w-[85vw] border-l-2 border-emerald-700 shadow-2xl overflow-y-auto"
                        style={{
                            zIndex: 999999,
                            backgroundColor: '#0a1f1a',
                            position: 'fixed'
                        }}
                    >
                        {/* Menu Header */}
                        <div className="p-6 border-b border-emerald-800">
                            <div className="flex justify-between items-center">
                                <h2 className="text-xl font-bold text-emerald-100">
                                    Kall<span className="text-emerald-400">ifornia</span>
                                </h2>
                                <button
                                    onClick={() => setIsOpen(false)}
                                    className="p-2 rounded-lg hover:bg-emerald-800/40 transition-colors"
                                    type="button"
                                >
                                    <X size={20} className="text-emerald-300" />
                                </button>
                            </div>
                            <p className="text-xs text-emerald-500 mt-2">Välj vy</p>
                        </div>

                        {/* Menu Items */}
                        <nav className="p-4">
                            {menuItems.map((item) => (
                                <button
                                    key={item.path}
                                    onClick={() => handleNavigate(item.path)}
                                    className="w-full text-left p-4 rounded-xl mb-2 bg-emerald-900/90 hover:bg-emerald-800 border border-emerald-700 hover:border-emerald-500 transition-all group"
                                    type="button"
                                >
                                    <div className="font-medium text-emerald-100 group-hover:text-emerald-50">
                                        {item.label}
                                    </div>
                                    {item.description && (
                                        <div className="text-xs text-emerald-500 mt-1">
                                            {item.description}
                                        </div>
                                    )}
                                </button>
                            ))}
                        </nav>

                        {/* Footer */}
                        <div className="absolute bottom-0 left-0 right-0 p-6 border-t border-emerald-800 bg-[#0a1f1a]">
                            <p className="text-xs text-emerald-600 text-center">
                                Vindsurfdata för Kallsjön
                            </p>
                        </div>
                    </div>
                </>,
                document.body
            )}
        </>
    );
}
