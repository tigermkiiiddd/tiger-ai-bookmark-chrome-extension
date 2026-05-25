#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
Gemini API 密钥诊断工具
帮助诊断和验证 Gemini API 密钥的常见问题
"""

import re
import requests
import json
from urllib.parse import quote

def diagnose_api_key():
    """诊断 API 密钥问题"""
    print("🔍 Gemini API 密钥诊断工具")
    print("=" * 50)
    
    # 获取用户输入的API密钥
    print("请输入你的 Gemini API 密钥:")
    api_key = input().strip()
    
    if not api_key:
        print("❌ 未输入API密钥")
        return
    
    # 1. 格式检查
    print("\n📋 1. API密钥格式检查")
    check_api_key_format(api_key)
    
    # 2. 网络连接测试
    print("\n🌐 2. 网络连接测试")
    check_network_connection()
    
    # 3. API密钥有效性验证
    print("\n🔑 3. API密钥有效性验证")
    check_api_key_validity(api_key)
    
    # 4. 额度和权限检查
    print("\n📊 4. 额度和权限检查")
    check_api_quota_and_permissions(api_key)
    
    # 5. 提供解决建议
    print("\n💡 5. 解决建议")
    provide_solutions()

def check_api_key_format(api_key):
    """检查API密钥格式"""
    # Gemini API密钥通常是39个字符，以AIza开头
    if len(api_key) != 39:
        print(f"⚠️  密钥长度异常: {len(api_key)} 字符 (标准应为39字符)")
    else:
        print(f"✅ 密钥长度正确: {len(api_key)} 字符")
    
    if not api_key.startswith('AIza'):
        print("⚠️  密钥格式异常: 标准Gemini API密钥应以 'AIza' 开头")
    else:
        print("✅ 密钥前缀正确: 以 'AIza' 开头")
    
    # 检查是否包含无效字符
    if not re.match(r'^[A-Za-z0-9_-]+$', api_key):
        print("⚠️  密钥包含无效字符: 只应包含字母、数字、下划线和连字符")
    else:
        print("✅ 密钥字符有效")
    
    # 检查是否有多余的空格或引号
    if api_key != api_key.strip():
        print("⚠️  密钥包含多余的空格")
    
    if api_key.startswith('"') and api_key.endswith('"'):
        print("⚠️  密钥包含引号，请去除引号")

def check_network_connection():
    """检查网络连接"""
    try:
        response = requests.get('https://generativelanguage.googleapis.com', timeout=10)
        print("✅ 可以访问 Google AI API 服务器")
    except requests.exceptions.ConnectionError:
        print("❌ 无法连接到 Google AI API 服务器 - 请检查网络连接")
    except requests.exceptions.Timeout:
        print("⚠️  连接超时 - 网络可能较慢")
    except Exception as e:
        print(f"⚠️  网络检查异常: {e}")

def check_api_key_validity(api_key):
    """验证API密钥有效性"""
    url = f"https://generativelanguage.googleapis.com/v1beta/models/gemini-pro:generateContent?key={api_key}"
    
    payload = {
        "contents": [{
            "parts": [{
                "text": "Hello"
            }]
        }],
        "generationConfig": {
            "temperature": 0.1,
            "topK": 1,
            "topP": 1,
            "maxOutputTokens": 10
        }
    }
    
    try:
        response = requests.post(
            url,
            headers={'Content-Type': 'application/json'},
            json=payload,
            timeout=30
        )
        
        if response.status_code == 200:
            print("✅ API密钥有效且工作正常")
            return True
        elif response.status_code == 400:
            error_data = response.json()
            error_msg = error_data.get('error', {}).get('message', '未知错误')
            print(f"❌ API请求格式错误: {error_msg}")
        elif response.status_code == 403:
            print("❌ API密钥无效或权限不足")
            print("   可能原因:")
            print("   - API密钥错误")
            print("   - API未启用")
            print("   - 账户被限制")
        elif response.status_code == 429:
            print("⚠️  API调用频率超限，请稍后重试")
        else:
            error_data = response.json() if response.headers.get('content-type', '').startswith('application/json') else {}
            error_msg = error_data.get('error', {}).get('message', f'HTTP {response.status_code}')
            print(f"❌ API调用失败: {error_msg}")
        
        return False
        
    except requests.exceptions.Timeout:
        print("❌ API请求超时")
        return False
    except requests.exceptions.ConnectionError:
        print("❌ 无法连接到API服务器")
        return False
    except Exception as e:
        print(f"❌ API验证异常: {e}")
        return False

def check_api_quota_and_permissions(api_key):
    """检查API额度和权限"""
    # 尝试调用一个更复杂的请求来检查权限
    url = f"https://generativelanguage.googleapis.com/v1beta/models?key={api_key}"
    
    try:
        response = requests.get(url, timeout=10)
        
        if response.status_code == 200:
            models_data = response.json()
            models = models_data.get('models', [])
            print(f"✅ 可访问的模型数量: {len(models)}")
            
            # 检查是否包含gemini-pro
            model_names = [model.get('name', '').split('/')[-1] for model in models]
            if 'gemini-pro' in model_names:
                print("✅ 可以使用 gemini-pro 模型")
            else:
                print("⚠️  无法访问 gemini-pro 模型")
                
        elif response.status_code == 403:
            print("❌ 权限不足，无法列出可用模型")
        else:
            print(f"⚠️  模型列表检查失败: HTTP {response.status_code}")
            
    except Exception as e:
        print(f"⚠️  权限检查异常: {e}")

def provide_solutions():
    """提供解决方案"""
    print("🔧 常见问题解决方案:")
    print()
    print("1. API密钥错误:")
    print("   - 重新访问 https://makersuite.google.com/app/apikey")
    print("   - 确保复制完整的密钥（39个字符）")
    print("   - 注意不要复制多余的空格或引号")
    print()
    print("2. API未启用:")
    print("   - 访问 https://console.cloud.google.com/")
    print("   - 启用 Generative Language API")
    print("   - 确保选择了正确的项目")
    print()
    print("3. 地区限制:")
    print("   - Gemini API 可能在某些地区不可用")
    print("   - 尝试使用VPN切换到支持的地区")
    print()
    print("4. 额度限制:")
    print("   - 检查 Google Cloud 控制台中的使用配额")
    print("   - 确保有足够的免费额度或已设置计费")
    print()
    print("5. 网络问题:")
    print("   - 检查防火墙设置")
    print("   - 尝试使用不同的网络环境")

def main():
    """主函数"""
    try:
        diagnose_api_key()
    except KeyboardInterrupt:
        print("\n\n👋 诊断已取消")
    except Exception as e:
        print(f"\n❌ 诊断工具异常: {e}")

if __name__ == "__main__":
    main()