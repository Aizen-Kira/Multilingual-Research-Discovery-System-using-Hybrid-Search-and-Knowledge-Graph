const fs = require('fs');
const path = require('path');

const dir = path.join('c:', 'Project', 'MLRD NO KG Control', 'MLRD NO KG Control', 'Frontend', 'src', 'components');

const PRIMARY = '#2563EB'; // Blue
const SECONDARY = '#64748B'; // Slate
const INVERTED = '#0F172A'; // Dark slate
const NEUTRAL = '#F8FAFC'; // Off-white
const WHITE = '#FFFFFF';

function getLuminance(hex) {
    hex = hex.replace('#', '');
    if (hex.length === 3) hex = hex.split('').map(c => c + c).join('');
    const r = parseInt(hex.substring(0, 2), 16) / 255;
    const g = parseInt(hex.substring(2, 4), 16) / 255;
    const b = parseInt(hex.substring(4, 6), 16) / 255;
    const a = [r, g, b].map(v => {
        return v <= 0.03928 ? v / 12.92 : Math.pow((v + 0.055) / 1.055, 2.4);
    });
    return a[0] * 0.2126 + a[1] * 0.7152 + a[2] * 0.0722;
}

function getClosestBrandColor(hex) {
    // Determine the closest brand color by basic luminance sorting.
    const lum = getLuminance(hex);
    if (lum > 0.8) return NEUTRAL; // light things go to neutral/white
    if (lum > 0.3) return SECONDARY; // medium things go to secondary
    return INVERTED; // dark things go to inverted
}

function walk(d) {
    const list = fs.readdirSync(d);
    for (const item of list) {
        const p = path.join(d, item);
        const stat = fs.statSync(p);
        if (stat.isDirectory()) {
            walk(p);
        } else if (p.endsWith('.tsx') || p.endsWith('.ts')) {
            let content = fs.readFileSync(p, 'utf8');

            // 1. Replace specific hex codes that often appear
            // e.g. bg-[#1A1F3A] -> bg-[var(--inverted)] or bg-[#0F172A]
            content = content.replace(/(bg|text|border|fill|stroke)-\[#(?:[0-9a-fA-F]{3,8})\]/g, (match, type) => {
                const hexMatch = match.match(/#(?:[0-9a-fA-F]{3,8})/)[0];
                const closest = getClosestBrandColor(hexMatch);
                return `${type}-[${closest}]`;
            });
            
            // 2. Replace explicit tailwind color names with generic ones if needed, 
            // but overriding the tailwind classes in config is safer. Actually, let's just use config for classes.

            fs.writeFileSync(p, content, 'utf8');
        }
    }
}

walk(dir);
console.log("Colors replaced in arbitrary hex tags.");
