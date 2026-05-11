# 版本查看与回滚说明

本项目使用 Git tag 管理稳定版本。alpha 版本用于公司内部试用，格式为 `v主版本.次版本.修订号-alpha`，例如 `v0.1.1-alpha`。

## 查看当前版本

页面底部会显示当前系统版本号，也可以打开 `/changelog` 查看版本记录。

命令行查看当前提交和 tag：

```bash
git status
git log --oneline --decorate -n 10
git tag --list --sort=-creatordate
```

## 切换到指定版本

仅查看某个历史版本：

```bash
git fetch --tags origin
git switch --detach v0.1.0-alpha
npm install
npm run build
```

如果需要从某个版本继续修复，请从 tag 新建分支：

```bash
git switch -c hotfix/v0.1.0-alpha v0.1.0-alpha
```

## 回滚本地代码

回滚前先确认没有未提交改动：

```bash
git status
```

如果要让本地 `main` 回到某个 tag：

```bash
git switch main
git reset --hard v0.1.0-alpha
```

注意：`reset --hard` 会丢弃本地未提交改动。执行前必须确认改动已经提交、备份，或不再需要。

## 恢复远程 main

推荐方式是创建一个回滚提交，保留历史：

```bash
git switch main
git pull origin main
git revert --no-edit <需要回滚的提交范围>
git push origin main
```

如果必须让远程 `main` 直接回到某个 tag，需要管理员确认后再执行：

```bash
git switch main
git reset --hard v0.1.0-alpha
git push --force-with-lease origin main
```

`--force-with-lease` 会检查远程分支是否被别人更新，比普通强推更安全。非紧急情况不建议使用。

## 发布新稳定版本

每次稳定版本发布必须完成两件事：

1. 更新 `lib/version.ts` 中的 `APP_VERSION` 和 `changelog`。
2. 提交代码后创建并推送 tag。

推荐流程：

```bash
npm run lint
npm run build
git status
git add .
git commit -m "chore: release v0.1.1-alpha"
npm run release:tag
git push origin main
git push origin v0.1.1-alpha
```

如果 tag 已存在但指向错误，不要直接覆盖。先确认原因，再由管理员决定是否删除并重新创建。
