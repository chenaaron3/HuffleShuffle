import React, { useState } from 'react';
import {
    AnimationProvider, ChipStream, PotSplash, PulsingChip, RollingNumber
} from '~/components/ui/chip-animations';

export function AnimationDemo() {
    const [showChipStream, setShowChipStream] = useState(false);
    const [showPotSplash, setShowPotSplash] = useState(false);
    const [showPulsingChip, setShowPulsingChip] = useState(false);
    const [rollingValue, setRollingValue] = useState(100);
    const [chipStreamAmount, setChipStreamAmount] = useState(50);
    const [pulsingChipAmount, setPulsingChipAmount] = useState(25);

    return (
        <AnimationProvider>
            <div className="p-8 bg-black text-white min-h-screen">
                <div className="max-w-4xl mx-auto">
                    <div className="text-center mb-8">
                        <h1 className="text-4xl font-bold mb-4 bg-gradient-to-r from-yellow-400 to-yellow-600 bg-clip-text text-transparent">
                            Poker Animation Demo
                        </h1>
                        <p className="text-gray-400 text-lg">
                            Interactive demo of all poker game animations
                        </p>
                    </div>

                    <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
                        {/* Rolling Number Animation */}
                        <div className="bg-gray-900/50 rounded-xl p-6 border border-gray-700">
                            <h2 className="text-xl font-semibold mb-4 text-yellow-400">Rolling Number Animation</h2>
                            <div className="space-y-4">
                                <div className="flex items-center justify-center">
                                    <RollingNumber
                                        value={rollingValue}
                                        className="text-4xl font-bold text-green-400"
                                        prefix="$"
                                    />
                                </div>
                                <div className="flex gap-2 justify-center">
                                    <button
                                        onClick={() => setRollingValue(prev => prev + Math.floor(Math.random() * 100) + 50)}
                                        className="px-4 py-2 bg-blue-600 rounded hover:bg-blue-700 transition-colors"
                                    >
                                        Increase Value
                                    </button>
                                    <button
                                        onClick={() => setRollingValue(prev => Math.max(0, prev - Math.floor(Math.random() * 50) + 25))}
                                        className="px-4 py-2 bg-red-600 rounded hover:bg-red-700 transition-colors"
                                    >
                                        Decrease Value
                                    </button>
                                </div>
                                <p className="text-sm text-gray-400 text-center">
                                    Robinhood-style rolling numbers with smooth transitions
                                </p>
                            </div>
                        </div>

                        {/* Chip Stream Animation */}
                        <div className="bg-gray-900/50 rounded-xl p-6 border border-gray-700">
                            <h2 className="text-xl font-semibold mb-4 text-yellow-400">Chip Stream Animation</h2>
                            <div className="space-y-4">
                                <div className="flex items-center gap-2">
                                    <label className="text-sm text-gray-300">Amount:</label>
                                    <input
                                        type="number"
                                        value={chipStreamAmount}
                                        onChange={(e) => setChipStreamAmount(Number(e.target.value))}
                                        className="w-20 px-2 py-1 bg-gray-800 border border-gray-600 rounded text-white"
                                        min="25"
                                        max="1000"
                                        step="25"
                                    />
                                </div>
                                <div className="text-xs text-gray-400 text-center">
                                    More chips for larger amounts (3-12 chips)
                                </div>
                                <div className="flex gap-1 justify-center">
                                    <button
                                        onClick={() => setChipStreamAmount(50)}
                                        className="px-2 py-1 text-xs bg-gray-700 hover:bg-gray-600 rounded"
                                    >
                                        $50
                                    </button>
                                    <button
                                        onClick={() => setChipStreamAmount(100)}
                                        className="px-2 py-1 text-xs bg-gray-700 hover:bg-gray-600 rounded"
                                    >
                                        $100
                                    </button>
                                    <button
                                        onClick={() => setChipStreamAmount(250)}
                                        className="px-2 py-1 text-xs bg-gray-700 hover:bg-gray-600 rounded"
                                    >
                                        $250
                                    </button>
                                    <button
                                        onClick={() => setChipStreamAmount(500)}
                                        className="px-2 py-1 text-xs bg-gray-700 hover:bg-gray-600 rounded"
                                    >
                                        $500
                                    </button>
                                </div>
                                <div className="flex gap-2">
                                    <button
                                        onClick={() => {
                                            console.log('Demo: Triggering chip stream');
                                            setShowChipStream(true);
                                            setTimeout(() => setShowChipStream(false), 1500);
                                        }}
                                        className="flex-1 px-4 py-2 bg-yellow-600 rounded hover:bg-yellow-700 transition-colors"
                                    >
                                        Trigger Chip Stream
                                    </button>
                                    <button
                                        onClick={() => {
                                            console.log('Demo: Testing multiple streams');
                                            setShowChipStream(true);
                                            setTimeout(() => setShowChipStream(false), 1500);
                                            setTimeout(() => {
                                                setShowChipStream(true);
                                                setTimeout(() => setShowChipStream(false), 1500);
                                            }, 200);
                                        }}
                                        className="px-4 py-2 bg-orange-600 rounded hover:bg-orange-700 transition-colors"
                                    >
                                        Test Multiple
                                    </button>
                                </div>
                                <p className="text-sm text-gray-400 text-center">
                                    Slot machine style chip explosion with randomized positions and sparkles
                                </p>
                                {showChipStream && (
                                    <div className="text-center text-yellow-400 text-sm font-semibold animate-pulse">
                                        🎯 Animation Active
                                    </div>
                                )}
                                <ChipStream
                                    fromPosition={{ x: 200, y: 400 }}
                                    toPosition={{ x: 600, y: 200 }}
                                    amount={chipStreamAmount}
                                    isVisible={showChipStream}
                                />
                            </div>
                        </div>

                        {/* Pot Splash Effect */}
                        <div className="bg-gray-900/50 rounded-xl p-6 border border-gray-700">
                            <h2 className="text-xl font-semibold mb-4 text-yellow-400">Pot Splash Effect</h2>
                            <div className="space-y-4">
                                <button
                                    onClick={() => {
                                        setShowPotSplash(true);
                                        setTimeout(() => setShowPotSplash(false), 1000);
                                    }}
                                    className="w-full px-4 py-2 bg-green-600 rounded hover:bg-green-700 transition-colors"
                                >
                                    Trigger Pot Splash
                                </button>
                                <p className="text-sm text-gray-400 text-center">
                                    Expanding rings with sparkle effects when chips hit the pot
                                </p>
                                <PotSplash isVisible={showPotSplash} />
                            </div>
                        </div>

                        {/* Pulsing Chip Animation */}
                        <div className="bg-gray-900/50 rounded-xl p-6 border border-gray-700">
                            <h2 className="text-xl font-semibold mb-4 text-yellow-400">Pulsing Chip Animation</h2>
                            <div className="space-y-4">
                                <div className="flex items-center gap-2">
                                    <label className="text-sm text-gray-300">Amount:</label>
                                    <input
                                        type="number"
                                        value={pulsingChipAmount}
                                        onChange={(e) => setPulsingChipAmount(Number(e.target.value))}
                                        className="w-20 px-2 py-1 bg-gray-800 border border-gray-600 rounded text-white"
                                        min="1"
                                        max="1000"
                                    />
                                </div>
                                <button
                                    onClick={() => {
                                        setShowPulsingChip(true);
                                        setTimeout(() => setShowPulsingChip(false), 1000);
                                    }}
                                    className="w-full px-4 py-2 bg-red-600 rounded hover:bg-red-700 transition-colors"
                                >
                                    Trigger Pulsing Chip
                                </button>
                                <p className="text-sm text-gray-400 text-center">
                                    Mario-style ground pound effect for bet increases
                                </p>
                                <PulsingChip amount={pulsingChipAmount} isVisible={showPulsingChip} />
                            </div>
                        </div>
                    </div>

                    {/* Animation Features */}
                    <div className="mt-12 bg-gray-900/30 rounded-xl p-6 border border-gray-700">
                        <h2 className="text-2xl font-semibold mb-4 text-yellow-400">Animation Features</h2>
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                            <div>
                                <h3 className="text-lg font-semibold mb-2 text-green-400">Implemented Features</h3>
                                <ul className="space-y-1 text-gray-300">
                                    <li>• Rolling number animations (Robinhood-style)</li>
                                    <li>• Chip streaming with particle trails</li>
                                    <li>• Pot splash effects with sparkles</li>
                                    <li>• Pulsing chip animations (Mario-style)</li>
                                    <li>• Entry animations for bet chips</li>
                                    <li>• Larger, more visible chip sizes</li>
                                    <li>• No decimal places for cleaner display</li>
                                </ul>
                            </div>
                            <div>
                                <h3 className="text-lg font-semibold mb-2 text-blue-400">Animation Triggers</h3>
                                <ul className="space-y-1 text-gray-300">
                                    <li>• Bet increases → Pulsing chip + rolling numbers</li>
                                    <li>• Betting round ends → Chip streams to pot + splash</li>
                                    <li>• Winner distribution → Chip streams to winners</li>
                                    <li>• All monetary changes → Rolling number animations</li>
                                    <li>• Visible to all players simultaneously</li>
                                </ul>
                            </div>
                        </div>
                    </div>

                    {/* Navigation */}
                    <div className="mt-8 text-center">
                        <a
                            href="/"
                            className="inline-flex items-center px-6 py-3 bg-yellow-600 hover:bg-yellow-700 rounded-lg transition-colors font-semibold"
                        >
                            ← Back to Game
                        </a>
                    </div>
                </div>
            </div>
        </AnimationProvider>
    );
}