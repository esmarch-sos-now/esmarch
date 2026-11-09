# Quy trình làm việc

```
feat/xxx ──PR──▶ dev ──PR──▶ main
```

- `dev`: nhánh mặc định, nơi gộp các tính năng.
- `main`: bản ổn định, chỉ nhận PR từ `dev`.
- Không push thẳng vào `main` hoặc `dev`.

## Làm một tính năng mới

```bash
git checkout dev
git pull
git checkout -b feat/ten-tinh-nang
# ... code, commit ...
git push -u origin feat/ten-tinh-nang
gh pr create --base dev
```

## Đưa lên main

```bash
gh pr create --base main --head dev --title "Release: ..."
```

## Đặt tên nhánh

`feat/...` tính năng · `fix/...` sửa lỗi · `chore/...` cấu hình · `docs/...` tài liệu
