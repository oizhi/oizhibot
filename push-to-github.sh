#!/bin/bash
# GitHub 推送脚本
# 使用方法: ./push-to-github.sh

echo "📦 准备推送到 GitHub..."
echo ""

# 检查是否已配置远程仓库
if git remote -v | grep -q "origin"; then
    echo "✅ 远程仓库已配置: origin"
else
    echo "⚠️  配置远程仓库..."
    git remote add origin https://github.com/ovws/oizhibot.git
fi

# 切换到 main 分支
echo "🔄 切换到 main 分支..."
git branch -M main

echo ""
echo "🔑 请选择认证方式："
echo ""
echo "方式 1: 使用 GitHub Personal Access Token (推荐)"
echo "  1. 访问: https://github.com/settings/tokens"
echo "  2. 点击 'Generate new token (classic)'"
echo "  3. 勾选 'repo' 权限"
echo "  4. 复制生成的 token"
echo "  5. 运行推送命令:"
echo ""
echo "     git push -u origin main"
echo ""
echo "  6. Username: 输入你的 GitHub 用户名"
echo "  7. Password: 粘贴你的 Personal Access Token"
echo ""
echo "方式 2: 使用 SSH (需要先配置 SSH key)"
echo "  1. 生成 SSH key: ssh-keygen -t ed25519 -C 'your_email@example.com'"
echo "  2. 添加到 GitHub: https://github.com/settings/keys"
echo "  3. 更改远程地址:"
echo ""
echo "     git remote set-url origin git@github.com:ovws/oizhibot.git"
echo "     git push -u origin main"
echo ""
echo "方式 3: 使用 GitHub CLI (gh)"
echo "  1. 安装: https://cli.github.com/"
echo "  2. 认证: gh auth login"
echo "  3. 推送: git push -u origin main"
echo ""
echo "═══════════════════════════════════════════════════════════"
echo ""
read -p "请选择方式 (1/2/3) 或按 Ctrl+C 取消: " choice

case $choice in
    1)
        echo ""
        echo "📝 请输入你的 GitHub 凭据..."
        git push -u origin main
        ;;
    2)
        echo ""
        echo "🔧 更改为 SSH URL..."
        git remote set-url origin git@github.com:ovws/oizhibot.git
        git push -u origin main
        ;;
    3)
        echo ""
        echo "🚀 使用 GitHub CLI 推送..."
        if command -v gh &> /dev/null; then
            gh auth status || gh auth login
            git push -u origin main
        else
            echo "❌ GitHub CLI 未安装"
            echo "安装方法: https://cli.github.com/"
            exit 1
        fi
        ;;
    *)
        echo "❌ 无效选择"
        exit 1
        ;;
esac

if [ $? -eq 0 ]; then
    echo ""
    echo "✅ 推送成功！"
    echo ""
    echo "🎉 访问你的仓库："
    echo "   https://github.com/ovws/oizhibot"
    echo ""
else
    echo ""
    echo "❌ 推送失败，请检查认证信息"
fi
