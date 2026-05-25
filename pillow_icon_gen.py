#!/usr/bin/env python3
from PIL import Image, ImageDraw, ImageFont
from pathlib import Path
import math

def create_icon(size):
    """创建指定尺寸的图标 - 简洁版主LOGO"""
    # 创建透明背景图像
    img = Image.new('RGBA', (size, size), (0, 0, 0, 0))
    draw = ImageDraw.Draw(img)
    
    # 背景渐变（简化为纯色）
    bg_color = (79, 70, 229, 255)  # #4f46e5
    corner_radius = size // 5
    
    # 绘制圆角矩形背景
    draw.rounded_rectangle([0, 0, size-1, size-1], radius=corner_radius, fill=bg_color)
    
    # 计算缩放比例
    scale = size / 128
    
    # 书本外框 - 主要图标元素
    book_x = int(24 * scale)
    book_y = int(20 * scale) 
    book_w = int(80 * scale)
    book_h = int(88 * scale)
    book_radius = int(12 * scale)
    
    # 书本背景（白色填充）
    draw.rounded_rectangle(
        [book_x, book_y, book_x + book_w, book_y + book_h],
        radius=book_radius,
        fill=(255, 255, 255, 255)
    )
    
    # 书本边框（深色轮廓）
    border_width = max(1, int(2 * scale))
    draw.rounded_rectangle(
        [book_x, book_y, book_x + book_w, book_y + book_h],
        radius=book_radius,
        outline=(79, 70, 229, 255),
        width=border_width
    )
    
    # 书签标记（标志性元素）
    bookmark_x = int(88 * scale)
    bookmark_y = int(20 * scale)
    bookmark_w = int(16 * scale)
    bookmark_h = int(24 * scale)
    
    bookmark_points = [
        (bookmark_x, bookmark_y),
        (bookmark_x + bookmark_w, bookmark_y),
        (bookmark_x + bookmark_w, bookmark_y + bookmark_h),
        (bookmark_x + bookmark_w//2, bookmark_y + bookmark_h - 6*scale),
        (bookmark_x, bookmark_y + bookmark_h)
    ]
    draw.polygon(bookmark_points, fill=(249, 115, 22, 255))  # 橙色书签
    
    # 书本内容线条（简化）
    line_height = max(1, int(3 * scale))
    line_spacing = int(12 * scale)
    text_x = int(32 * scale)
    text_start_y = int(32 * scale)
    
    # 绘制更简洁的线条
    line_widths = [60, 56, 64, 48, 52]  # 不同长度的线条
    for i, width in enumerate(line_widths):
        if text_start_y + i * line_spacing < book_y + book_h - 16 * scale:
            draw.rectangle([
                text_x, 
                text_start_y + i * line_spacing,
                text_x + int(width * scale),
                text_start_y + i * line_spacing + line_height
            ], fill=(79, 70, 229, 180))  # 半透明蓝色线条
    
    # Tiger标记（简化的装饰元素）
    tiger_center = (int(48 * scale), int(88 * scale))
    tiger_radius = int(8 * scale)
    
    # 小圆点装饰
    draw.ellipse([
        tiger_center[0] - tiger_radius,
        tiger_center[1] - tiger_radius,
        tiger_center[0] + tiger_radius,
        tiger_center[1] + tiger_radius
    ], fill=(16, 185, 129, 255))  # 绿色小圆点
    
    # 简单的装饰线条
    stripe_width = max(1, int(2 * scale))
    stripe_len = int(12 * scale)
    stripe_y = int(88 * scale)
    
    draw.rectangle([
        tiger_center[0] + int(12 * scale),
        stripe_y - stripe_width//2,
        tiger_center[0] + int(12 * scale) + stripe_len,
        stripe_y + stripe_width//2
    ], fill=(16, 185, 129, 255))
    
    return img

def generate_icons():
    """生成所有尺寸的图标"""
    print("🚀 Chrome Extension 图标生成器 (Pillow版)")
    
    # 确保目录存在
    icons_dir = Path("public/icons")
    icons_dir.mkdir(parents=True, exist_ok=True)
    
    # 生成各种尺寸的PNG
    sizes = [16, 32, 48, 128]
    success_count = 0
    
    for size in sizes:
        try:
            img = create_icon(size)
            output_path = icons_dir / f"icon{size}.png"
            img.save(output_path, 'PNG', optimize=True)
            print(f"✅ 生成 {size}x{size}: {output_path}")
            success_count += 1
        except Exception as e:
            print(f"❌ 生成 {size}x{size} 失败: {e}")
    
    print(f"\n🎉 图标生成完成! 成功生成 {success_count}/{len(sizes)} 个图标")
    
    # 列出生成的文件
    print("\n📁 生成的图标文件:")
    for file in sorted(icons_dir.glob("icon*.png")):
        size_info = f"({file.stat().st_size} bytes)"
        print(f"  - {file.name} {size_info}")

if __name__ == "__main__":
    generate_icons()