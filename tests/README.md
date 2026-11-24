# Testes

Execute os comandos na raiz do repositório. Os testes estão separados por finalidade:

| Pasta | Entrada | Execução |
| --- | --- | --- |
| `api/` | `api.test.js` | `npm test`, contra servidor de teste já preparado. |
| `security/` | `seguranca.test.js` | `npm run test:seguranca`, somente no banco temporário autorizado. |
| `e2e/` | `painel.test.cjs` | `npm run test:painel`, prepara e executa toda a validação. |
| `unit/` | `ambiente.test.js` | `npm run test:unit`, valida configuração sem banco. |
| `integration/` | `relatorios.test.js` | `npm run test:volume`, executado pela suíte completa em banco temporário. |

## Suíte completa

```sh
npm run test:painel
```

Requer MySQL 8, Node.js 22+ com `WebSocket` global e Chrome/Chromium. O Chrome utiliza o caminho padrão `C:/Program Files/Google/Chrome/Application/chrome.exe`; defina `CHROME_PATH` para outro executável. A conexão utiliza as variáveis `DB_HOST`, `DB_PORT`, `DB_USER` e `DB_PASSWORD` do ambiente ou `.env`.

A suíte cria um banco `fhdod_verify_<identificador>`, importa o schema, verifica migrações e cria contas próprias. Inicia seu servidor em porta livre, executa API, segurança e integração/volume e exercita as telas pelo navegador. O cenário de volume cria 20.001 avaliações e 220.011 respostas em setor exclusivo, valida paginação, totais e Excel e remove esses dados antes dos testes de navegador. Uma amostra separada mede 100 consultas de saúde com concorrência 10; não substitui teste de carga no destino. O banco temporário é removido ao finalizar; uma interrupção abrupta pode deixar um banco residual. São necessárias permissões de criação/remoção desse banco e de triggers apenas para os testes.

As capturas ficam em `verification/screenshots/`; os perfis do Chrome ficam em `verification/browser/`. Esses arquivos são locais e ignorados pelo Git. O navegador de teste usa `--no-sandbox` e não deve ser utilizado para navegação comum.

Os testes isolados de API e segurança alteram dados. Não configure `BASE_URL` nem credenciais de teste para uma instalação operacional. A suíte de segurança recusa nomes de banco fora do padrão temporário.

## Verificação sintática

```sh
npm run lint
```

Verifica os JavaScript próprios em `src/`, `frontend/src/`, `scripts/` e `tests/`. A biblioteca de terceiros em `vendor/` é preservada e não é modificada por essa verificação.
