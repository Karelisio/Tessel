# Publication automatique

Chaque push sur `main` déclenche le workflow `.github/workflows/release.yml` :

1. installation, `lint`, `typecheck` et tests ;
2. décodage du keystore de signature depuis le secret `ANDROID_KEYSTORE_BASE64` ;
3. `semantic-release` analyse les commits depuis la dernière release :
   - aucun commit pertinent (`feat`, `fix`, `perf`, ou changement majeur) : **aucune release** ;
   - sinon il calcule la version `X.Y.Z`, lance `scripts/ci/build-release.sh X.Y.Z` (build web, `cap sync`,
     `gradlew assembleRelease`, vérification `apksigner`), puis crée le tag `vX.Y.Z` et la GitHub Release avec les notes
     (Nouveautés / Corrections / Performances) et les assets `tessel-vX.Y.Z.apk` et `tessel-vX.Y.Z.apk.sha256`.

L'application se met à jour depuis la dernière Release en lisant ces deux assets. Aucun commit n'est poussé par la CI :
`package.json` reste en `0.0.0-development`, la version est injectée via `TESSEL_VERSION` (voir `android/app/build.gradle`,
`versionCode = MAJEUR*1000000 + MINEUR*1000 + PATCH`).

Le workflow peut aussi être lancé à la main (`workflow_dispatch`).

## Secrets GitHub requis

À définir dans _Settings > Secrets and variables > Actions_ :

| Secret                      | Contenu                                                                |
| --------------------------- | ---------------------------------------------------------------------- |
| `ANDROID_KEYSTORE_BASE64`   | keystore `.jks` encodé en base64, sur une seule ligne                  |
| `ANDROID_KEYSTORE_PASSWORD` | mot de passe du keystore                                               |
| `ANDROID_KEY_ALIAS`         | facultatif : alias de la clé, lu dans le keystore s'il n'y en a qu'une |
| `ANDROID_KEY_PASSWORD`      | facultatif : mot de passe de la clé, celui du keystore par défaut      |

Si `ANDROID_KEYSTORE_BASE64` est vide ou absent, le workflow échoue immédiatement avec un message explicite.

## Créer le keystore (une seule fois)

```bash
keytool -genkeypair -v -keystore tessel-release.jks -storetype PKCS12 \
  -alias tessel -keyalg RSA -keysize 4096 -validity 10000
```

Encodage en base64 :

```bash
# Linux
base64 -w0 tessel-release.jks

# macOS
base64 -i tessel-release.jks | tr -d '\n'
```

```powershell
# PowerShell
[Convert]::ToBase64String([IO.File]::ReadAllBytes("tessel-release.jks"))
```

Copier la sortie dans le secret `ANDROID_KEYSTORE_BASE64`.

**Toujours utiliser le même keystore.** Android refuse d'installer une mise à jour signée avec une autre clé : en cas
de perte ou de changement de clé, les utilisateurs devraient désinstaller l'application (et perdraient leurs données).
Conserver une sauvegarde du `.jks` et de ses mots de passe hors du dépôt (`*.jks` est ignoré par git).

## Commits conventionnels

Le message du commit (ou le titre du squash de la PR) détermine la version :

| Message                                                     | Effet                      |
| ----------------------------------------------------------- | -------------------------- |
| `feat: ...`                                                 | version mineure (0.X.0)    |
| `fix: ...` ou `perf: ...`                                   | version corrective (patch) |
| `feat!: ...` ou pied `BREAKING CHANGE: ...`                 | version majeure (X.0.0)    |
| `docs`, `style`, `refactor`, `test`, `build`, `ci`, `chore` | aucune release             |

Exemple : `fix(engine): corrige le zoom au double tap`. Les messages sont vérifiés par commitlint (hook husky et CI).
