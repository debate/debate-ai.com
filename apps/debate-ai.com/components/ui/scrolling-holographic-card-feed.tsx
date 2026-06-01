"use client";

import React from 'react';

// --- Reusable UI Element Components ---

export const DataReadout = ({ value }: { value: string }) => (
    <div className="font-['Orbitron'] text-cyan-400 text-4xl" style={{ textShadow: '0 0 5px var(--cyan-glow)' }}>
        {value}
    </div>
);

export const HoloButton = ({ text }: { text: string }) => (
    <button className="holo-button">
        {text}
    </button>
);

export const ProgressBar = ({ progress }: { progress: number }) => (
    <div className="progress-bar">
        <div
            className="progress-bar-inner"
            style={{ width: `${progress}%` }}
        ></div>
    </div>
);

export const DataViz = ({ bars = 5 }: { bars?: number }) => (
    <div className="flex gap-1 items-end h-12">
        {Array.from({ length: bars }).map((_, i) => (
            <div
                key={i}
                className="data-viz-bar"
                style={{ animationDelay: `${i * 0.2}s` }}
            ></div>
        ))}
    </div>
);

export const GlowingOrb = ({ color }: { color?: string }) => (
    <div
        className="glowing-orb"
        style={{
            ['--orb-color' as string]: color || 'var(--cyan-bright)',
            ['--orb-glow' as string]: color ? '#FF8C00' : 'var(--cyan-glow)'
        } as React.CSSProperties}
    ></div>
);

// --- Core Components ---

interface CardTypeInfo {
    id: string;
    component: React.ComponentType<any>;
    props: Record<string, any>;
}

export const HoloCard = ({ typeInfo }: { typeInfo: CardTypeInfo }) => {
    const Component = typeInfo.component;
    return (
        <article className="holo-card">
            <div className="card-content">
                <div className="card-preview-content">
                    <Component {...typeInfo.props} />
                </div>
                <a className="fake-link" href="#">Link to post</a>
            </div>
        </article>
    );
};

export const ScrollingRow = ({
    cards,
    duration,
    direction = 'left'
}: {
    cards: CardTypeInfo[];
    duration: string;
    direction?: 'left' | 'right';
}) => {
    const rowContent = [...cards, ...cards]; // Duplicate for seamless animation

    return (
        <div className="grid-container">
            <div
                className="scrolling-grid"
                style={{
                    ['--scroll-duration' as string]: duration,
                    animationName: direction === 'left' ? 'scroll-left' : 'scroll-right',
                } as React.CSSProperties}
            >
                {rowContent.map((card, index) => <HoloCard key={`${card.id}-${index}`} typeInfo={card} />)}
            </div>
        </div>
    );
};

export const Starfield = () => <div className="starfield" />;
