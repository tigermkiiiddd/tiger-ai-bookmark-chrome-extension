#!/usr/bin/env python3
import os
import cairosvg
from pathlib import Path

def generate_icons():
    print("🚀 Chrome Extension 图标生成器")
    
    # SVG 内容
    svg = '''<?xml version="1.0" encoding="UTF-8"?>
<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 128 128" width="128" height="128">
  <defs>
    <linearGradient id="grad1" x1="0%" y1="0%" x2="100%" y2="100%">
      <stop offset="0%" style="stop-color:#4f46e5;stop-opacity:1" />
      <stop offset="100%" style="stop-color:#7c3aed;stop-opacity:1" />
    </linearGradient>
  </defs>
  <rect width="128" height="128" rx="24" fill="url(#grad1)"/>
  <g fill="none" stroke="white" stroke-width="3">
    <rect x="32" y="24" width="64" height="80" rx="8"/>
    <path d="M88 24 L88 40 L96 32 L104 40 L104 24" fill="white" stroke="none"/>
  </g>
  <g fill="white">
    <rect x="42" y="36" width="44" height="2"/>
    <rect x="42" y="44" width="44" height="2"/>
    <rect x="42" y="52" width="44" height="2"/>
    <rect x="42" y="60" width="32" height="2"/>
    <rect x="42" y="68" width="36" height="2"/>
    <rect x="42" y="76" width="28" height="2"/>
  </g>
  <circle cx="56" cy="88" r="10" fill="#f97316"/>
  <g stroke="#7c3aed" stroke-width="2" stroke-linecap="round">
    <line x1="48" y1="84" x2="64" y2="84"/>
    <line x1="50" y1="88" x2="62" y2="88"/>
    <line x1="48" y1="92" x2="64" y2="92"/>
  </g>
  <circle cx="88" cy="88" r="8" fill="#10b981"/>
  <text x="88" y="93" text-anchor="middle" fill="white" font-family="Arial" font-size="10" font-weight="bold">AI</text>
  <text x="64" y="118" text-anchor="middle" fill="white" font-family="Arial" font-size="11" font-weight="bold">TM III</text>
</svg>'''
    
    # 确保目录存在
    icons_dir = Path("public/icons")
    icons_dir.mkdir(parents=True, exist_ok=True)
    
    # 保存SVG
    svg_path = icons_dir / "icon.svg"
    with open(svg_path, 'w', encoding='utf-8') as f:
        f.write(svg)
    print(f"📝 SVG保存: {svg_path}")
    
    # 生成PNG图标
    sizes = [16, 32, 48, 128]
    for size in sizes:
        output_path = icons_dir / f"icon{size}.png"
        try:
            cairosvg.svg2png(
                bytestring=svg.encode('utf-8'),
                write_to=str(output_path),
                output_width=size,
                output_height=size
            )
            print(f"✅ 生成 {size}x{size}: {output_path}")
        except Exception as e:
            print(f"❌ 生成 {size}x{size} 失败: {e}")
    
    print("🎉 图标生成完成!")

if __name__ == "__main__":
    generate_icons()