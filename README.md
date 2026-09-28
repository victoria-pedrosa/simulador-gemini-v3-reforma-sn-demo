# Simulador Gemini V3 Reforma Sn

> Projeto de portfólio de **Victória Pedrosa** (Automação, Processos e Dados). Automação desenvolvida para um escritório de contabilidade; **esta é uma versão com dados fictícios** — nomes, CNPJs, e-mails e IDs internos foram substituídos.

## Problema de negócio
Simular a reforma para toda a carteira do Simples exigia ler extratos do PGDAS-D e classificar cada empresa.

## Antes x depois
| | Antes | Depois |
|---|---|---|
| Como é feito | Leitura manual de extratos e classificação empresa a empresa. | Script importa as empresas, lê os extratos do PGDAS-D, monta a correlação CNAE x item x NBS e simula 2027 com apoio do Gemini. |

## Ganho
- Simulação em lote da carteira inteira.

## Tecnologias
Google Apps Script, Google Drive, Google Sheets

## Arquivos
- `Codigo.gs`
- `DadosSegmentos.exemplo.gs`

## Como usar
Crie um projeto no Google Apps Script, copie os arquivos `.gs`/`.html` e configure as Propriedades do script indicadas no código.

## Autora
Victória Pedrosa — Product Owner do Time de IA, automação de processos contábeis e fiscais.
