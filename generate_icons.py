#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
Chrome Extension Icon Generator
使用Python将SVG转换为不同尺寸的PNG图标
"""

import os
from pathlib import Path

def install_requirements():
    """安装必要的依赖"""
    try:
        import cairosvg
        from PIL import Image
        print("✅ 依赖已安装")
        return True
    except ImportError:
        print("📦 正在安装依赖包...")
        os.system("pip install cairosvg pillow")
        try:
            import cairosvg
            from PIL import Image
            print("✅ 依赖安装成功")
            return True
        except ImportError:
            print("❌ 依赖安装失败，请手动安装: pip install cairosvg pillow")
            return False

def create_svg_icon():
    """创建优化的SVG图标"""
    svg_content = '''<?xml version="1.0" encoding="UTF-8"?>
<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 128 128" width="128" height="128">
  <defs>
    <linearGradient id="grad1" x1="0%" y1="0%" x2="100%" y2="100%">
      <stop offset="0%" style="stop-color:#4f46e5;stop-opacity:1" />
      <stop offset="100%" style="stop-color:#7c3aed;stop-opacity:1" />
    </linearGradient>
  </defs>
  
  <!-- 背景圆角矩形 -->
  <rect width="128" height="128" rx="24" fill="url(#grad1)"/>
  
  <!-- 书签本图标 -->
  <g fill="none" stroke="white" stroke-width="3">
    <rect x="32" y="24" width="64" height="80" rx="8"/>
    <!-- 书签标记 -->
    <path d="M88 24 L88 40 L96 32 L104 40 L104 24" fill="white" stroke="none"/>
  </g>
  
  <!-- 书本内容线条 -->
  <g fill="white">
    <rect x="42" y="36" width="44" height="2"/>
    <rect x="42" y="44" width="44" height="2"/>
    <rect x="42" y="52" width="44" height="2"/>
    <rect x="42" y="60" width="32" height="2"/>
    <rect x="42" y="68" width="36" height="2"/>
    <rect x="42" y="76" width="28" height="2"/>
  </g>
  
  <!-- Tiger标记 - 橙色圆圈带条纹 -->
  <circle cx="56" cy="88" r="10" fill="#f97316"/>
  <g stroke="#7c3aed" stroke-width="2" stroke-linecap="round">
    <line x1="48" y1="84" x2="64" y2="84"/>
    <line x1="50" y1="88" x2="62" y2="88"/>
    <line x1="48" y1="92" x2="64" y2="92"/>
  </g>
  
  <!-- AI标识 -->
  <circle cx="88" cy="88" r="8" fill="#10b981"/>
  <text x="88" y="93" text-anchor="middle" fill="white" font-family="Arial" font-size="10" font-weight="bold">AI</text>
  
  <!-- 版本标识 -->
  <text x="64" y="118" text-anchor="middle" fill="white" font-family="Arial" font-size="11" font-weight="bold">TM III</text>
</svg>'''
    
    return svg_content

def svg_to_png(svg_content, output_path, size):
    """将SVG转换为指定尺寸的PNG"""
    try:
        import cairosvg
        from PIL import Image
        import io
        
        # 使用cairosvg将SVG转换为PNG字节流
        png_bytes = cairosvg.svg2png(
            bytestring=svg_content.encode('utf-8'),
            output_width=size,
            output_height=size
        )
        
        # 使用PIL进一步优化
        image = Image.open(io.BytesIO(png_bytes))
        
        # 确保是RGBA模式
        if image.mode != 'RGBA':
            image = image.convert('RGBA')
        
        # 保存为PNG
        image.save(output_path, 'PNG', optimize=True)
        print(f"✅ 生成 {size}x{size} 图标: {output_path}")
        return True
        
    except Exception as e:
        print(f"❌ 生成 {size}x{size} 图标失败: {e}")
        return False

def generate_icons():
    """生成所有尺寸的图标"""
    # 图标尺寸
    sizes = [16, 32, 48, 128]
    
    # 确保图标目录存在
    icons_dir = Path("public/icons")
    icons_dir.mkdir(parents=True, exist_ok=True)
    
    # 创建SVG内容
    svg_content = create_svg_icon()
    
    # 保存SVG文件
    svg_path = icons_dir / "icon.svg"
    with open(svg_path, 'w', encoding='utf-8') as f:
        f.write(svg_content)
    print(f"📝 SVG图标已保存: {svg_path}")
    
    # 生成各种尺寸的PNG
    success_count = 0
    for size in sizes:
        output_path = icons_dir / f"icon{size}.png"
        if svg_to_png(svg_content, output_path, size):
            success_count += 1
    
    print(f"\n🎉 图标生成完成! 成功生成 {success_count}/{len(sizes)} 个图标")
    
    # 列出生成的文件
    print("\n📁 生成的图标文件:")
    for file in sorted(icons_dir.glob("icon*")):
        size_info = f"({file.stat().st_size} bytes)" if file.suffix == ".png" else ""
        print(f"  - {file.name} {size_info}")

def main():
    """主函数"""
    print("🚀 Chrome Extension 图标生成器")
    print("=" * 40)
    
    # 检查并安装依赖
    if not install_requirements():
        return
    
    # 生成图标
    generate_icons()
    
    print("\n✨ 图标生成完成！现在可以构建Chrome扩展了。")
    print("💡 提示: 运行 'npm run build' 来构建扩展")

if __name__ == "__main__":
    main()