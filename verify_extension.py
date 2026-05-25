#!/usr/bin/env python3
# Chrome扩展加载验证脚本

import os
from pathlib import Path
import json

def check_extension_ready():
    """检查Chrome扩展是否准备就绪"""
    print("🔍 Chrome扩展加载验证")
    print("=" * 50)
    
    # 检查dist目录
    dist_path = Path("dist")
    if not dist_path.exists():
        print("❌ dist目录不存在！请先运行: npm run build")
        return False
    
    print("✅ dist目录存在")
    
    # 必需文件列表
    required_files = [
        "manifest.json",
        "background.js", 
        "content.js",
        "popup/index.html",
        "options/index.html",
        "icons/icon16.png",
        "icons/icon32.png", 
        "icons/icon48.png",
        "icons/icon128.png"
    ]
    
    missing_files = []
    
    # 检查每个必需文件
    for file_path in required_files:
        full_path = dist_path / file_path
        if full_path.exists() and full_path.stat().st_size > 0:
            print(f"✅ {file_path} ({full_path.stat().st_size} bytes)")
        else:
            print(f"❌ {file_path} - 缺失或为空")
            missing_files.append(file_path)
    
    # 验证manifest.json格式
    manifest_path = dist_path / "manifest.json"
    if manifest_path.exists():
        try:
            with open(manifest_path, 'r', encoding='utf-8') as f:
                manifest = json.load(f)
            
            print("\n📋 Manifest验证:")
            print(f"✅ 扩展名称: {manifest.get('name', 'N/A')}")
            print(f"✅ 版本: {manifest.get('version', 'N/A')}")
            print(f"✅ 清单版本: {manifest.get('manifest_version', 'N/A')}")
            
            # 检查关键字段
            if manifest.get('manifest_version') != 3:
                print("⚠️  警告: 不是Manifest V3")
            
            if 'background' not in manifest:
                print("❌ 缺少background配置")
                missing_files.append("background配置")
                
            if 'action' not in manifest:
                print("❌ 缺少action配置") 
                missing_files.append("action配置")
                
        except json.JSONDecodeError as e:
            print(f"❌ manifest.json格式错误: {e}")
            missing_files.append("manifest格式")
    
    # 总结
    print("\n" + "=" * 50)
    if missing_files:
        print(f"❌ 发现 {len(missing_files)} 个问题:")
        for file in missing_files:
            print(f"   - {file}")
        print("\n🔧 解决方案:")
        print("1. 运行: npm run build")
        print("2. 运行: python pillow_icon_gen.py")
        print("3. 复制: Copy-Item manifest.json dist/manifest.json")
        return False
    else:
        print("🎉 所有文件检查通过！")
        print("\n📂 加载路径:")
        print(f"   {os.path.abspath('dist')}")
        print("\n🚀 现在可以在Chrome中加载扩展了！")
        print("   1. 打开: chrome://extensions/")
        print("   2. 启用: 开发者模式")
        print("   3. 选择上述路径加载扩展")
        return True

if __name__ == "__main__":
    check_extension_ready()