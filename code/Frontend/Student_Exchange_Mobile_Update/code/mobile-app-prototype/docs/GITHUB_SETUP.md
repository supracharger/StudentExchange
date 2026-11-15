> Backend-integration update: see [BACKEND_INTEGRATION.md](BACKEND_INTEGRATION.md) first. Add this package under `code/mobile-app-prototype/` in a feature branch; keep the existing backend and website in place. The included `.env.example` is safe configuration documentation; your `.env` is ignored and must not be committed.

# Add the files to GitHub

Extract the ZIP first. It contains one `student-exchange` folder. No remote repository is configured and nothing has been pushed automatically.

## New repository

Create an empty repository in your GitHub account or team organization. To avoid an initial-history conflict, do not initialize the remote with a README, license, or gitignore. In a terminal inside the extracted `student-exchange` folder:

```bash
git init
git branch -M main
git add .
git status
git commit -m "Add Student Exchange prototypes and technical guide"
git remote add origin https://github.com/YOUR_ORG/YOUR_REPOSITORY.git
git push -u origin main
```

Replace the clone URL placeholder with the real URL of your repository. Git may ask you to authenticate or configure your commit name and email. Do not put tokens or passwords in source files or in the remote URL.

## Existing team repository

Copy the entire `student-exchange` folder into a suitable location in an up-to-date checkout, such as `prototypes/student-exchange`. Keep its contents together so the original frontend/backend files are not overwritten. From the team repository root:

```bash
git switch -c feature/student-exchange-prototype
git add prototypes/student-exchange
git status
git commit -m "Add Student Exchange mobile prototype"
git push -u origin feature/student-exchange-prototype
```

Choose an unused branch name if necessary and open a pull request for review. These steps do not merge or replace the group's existing code.

## Browser upload

You can use the repository upload interface to upload the extracted files. Preserve the folder structure and include `.gitignore`, `.gitattributes`, and `web/dist/.nojekyll`. Uploading only the ZIP will not make source files browseable or directly runnable from the repository.

## Confirm the upload

- `web`, `mobile`, `scripts`, and `docs` are present.
- The files in `web/dist` are included; that directory must not be ignored.
- `node_modules`, `.expo`, hosting-specific `.openai` files, and temporary QA files are absent.
- From the prototype folder, `npm test`, `npm run check`, and `npm run web` work.

## Hosting

Uploading files does not automatically publish a website. Configure a static host to serve the contents of `web/dist`. If the prototype is nested in your group repository, include its parent directories in the deployment path. The existing private deployment does not automatically follow commits to the new repository.
