# Guia de instalacao do SNES Tizen Emulator

Este guia mostra, passo a passo, como instalar o SNES Tizen Emulator na sua
propria Smart TV Samsung (Tizen). O processo e o mesmo que desenvolvedores usam
para testar aplicativos na TV (sideload com o Developer Mode ligado).

Versao em ingles (principal): [INSTALL.md](INSTALL.md).

Leia primeiro a secao abaixo sobre o certificado. Ela explica por que nao existe
um instalador de um clique e por que cada pessoa precisa fazer alguns passos na
primeira vez.

## Antes de comecar: a restricao do certificado

A Samsung exige que todo aplicativo instalado na TV esteja assinado com um
certificado valido. O certificado de distribuidor fica amarrado ao DUID
(identificador unico) da TV de destino. Na pratica isso significa:

- Nao existe um `.wgt` pronto que instale em qualquer TV. Um pacote assinado com
  o DUID de uma TV nao instala em outra.
- Cada pessoa precisa gerar o proprio certificado, com a propria conta Samsung e
  o DUID da propria TV, e assinar o pacote.
- O passo da conta Samsung mais o certificado por aparelho nao e automatizavel.
  Por isso a instalacao e feita por este passo a passo, e nao por um instalador
  automatico.

Fonte: Samsung Developers, "Creating Certificates".

## Pre-requisitos

- Smart TV Samsung com Tizen (o projeto foi validado na Samsung 65BU8000, Tizen
  6.5).
- PC com Windows na mesma rede da TV (cabo ou Wi-Fi).
- Conta gratuita no Samsung Developers Portal (https://developer.samsung.com).
- Tizen Studio instalado, com o pacote "Samsung Certificate Extension".
- Os arquivos deste repositorio baixados no PC.

Tempo estimado na primeira vez: 30 a 60 minutos. A maior parte (instalar o Tizen
Studio e criar o certificado) e feita apenas uma vez. As proximas instalacoes
sao rapidas.

## Passo 1: Instalar o Tizen Studio e a extensao de certificado

1. Baixe e instale o Tizen Studio (versao com IDE) no site da Samsung.
2. Abra o Package Manager do Tizen Studio.
3. Na aba "Extension SDK", instale o "Samsung Certificate Extension".

> Imagem 01: Package Manager com o Samsung Certificate Extension instalado.

## Passo 2: Ligar o Developer Mode na TV

1. Na TV, abra o Smart Hub e va ate o painel de Apps.
2. Entre em "Configuracoes de Apps" (App Settings).
3. Digite 12345 no teclado do controle ou na tela. Abre o popup do Developer
   Mode.
4. Ligue "Developer mode" (On).
5. Informe o IP do PC que vai se conectar a TV e confirme em "OK".
6. Reinicie a TV. Ao voltar, aparece "Develop Mode" no topo do painel de Apps.

Para descobrir o IP do PC no Windows: abra o Prompt de Comando, rode `ipconfig`
e use o "Endereco IPv4" da sua rede.

> Imagem 02: popup do Developer Mode na TV com o IP do PC preenchido.

## Passo 3: Descobrir o IP da TV e conectar

1. Na TV: Configuracoes > Geral (ou Conexao) > Rede > Status da Rede >
   Configuracoes de IP. Anote o endereco IP da TV.
2. No PC, abra o Tizen Studio e va em "Tools > Device Manager".
3. Clique em "Remote Device Manager" e depois no botao "+".
4. Em "Add Device", informe um nome, o IP da TV e a porta 26101, e clique em
   "Add".
5. Selecione a TV na lista e mude "Connection" para "On". A TV deve aparecer como
   conectada.

> Imagem 03: Device Manager com a TV conectada.

## Passo 4: Obter o DUID da TV

O DUID e o identificador unico da TV, necessario para gerar o certificado. Ha
duas formas de obte-lo:

- Na TV: Menu > Suporte (Support) > Fale com a Samsung (Contact Samsung) >
  "Unique Device ID".
- No Tizen Studio: com a TV conectada (Passo 3), o DUID tambem pode ser puxado
  direto do dispositivo conectado durante a criacao do certificado (Passo 5).

> Imagem 04: DUID exibido (na TV ou no assistente do Tizen Studio).

## Passo 5: Criar o certificado Samsung

1. No Tizen Studio, abra "Tools > Certificate Manager".
2. Se aparecer a janela "Migration for Certificate Profile", clique em "Cancel".
3. Clique em "+" para abrir o assistente de criacao de perfil.
4. Clique em "Samsung".
5. Selecione "TV" e clique em "Next".
6. De um nome ao perfil e clique em "Next". Guarde esse nome: ele sera usado para
   assinar o pacote.
7. Certificado de autor (author certificate):
   - Escolha "Create a new author certificate" e clique em "Next".
   - Preencha os dados e clique em "Next".
   - Faca login com a sua conta Samsung Developer.
   - Defina um caminho de backup para o arquivo do certificado e clique em
     "Next".
8. Certificado de distribuidor (distributor certificate):
   - Escolha "Create a new distributor certificate" e clique em "Next".
   - Defina o nivel de privilegio necessario.
   - Informe o DUID da TV manualmente, ou clique no "+" ao lado do dispositivo
     conectado na lista.
9. Clique em "Finish".

Importante: guarde o certificado de autor em local seguro. Atualizacoes do app
precisam ser assinadas com o mesmo certificado de autor, senao a TV pode tratar
a nova versao como outro aplicativo.

> Imagem 05: assistente do Certificate Manager na etapa do DUID.

## Passo 6: Importar o projeto no Tizen Studio

1. No Tizen Studio, use "File > Import > Tizen > Tizen Project".
2. Aponte para a pasta deste repositorio (a raiz, onde estao `config.xml` e
   `index.html`).
3. Confirme que o perfil de certificado ativo e o que voce criou. No Certificate
   Manager, o perfil ativo aparece marcado.

> Imagem 06: projeto importado e perfil de certificado ativo.

## Passo 7: Empacotar, assinar, instalar e abrir

Com a TV conectada (Passo 3) e o perfil de certificado ativo (Passo 5):

1. Clique com o botao direito no projeto importado.
2. Escolha "Run As > Tizen Web Application".
3. O Tizen Studio empacota, assina, instala e abre o app na TV em uma unica
   acao.

Pronto. O icone do SNES Tizen Emulator passa a aparecer na TV, e o app pode ser
aberto pelo lilauncher.

> Imagem 07: SNES Tizen Emulator aberto na TV.

## Alternativa por linha de comando

Quem tem familiaridade com terminal pode fazer os mesmos passos pela CLI do
Tizen, sem a interface grafica. O fluxo e: conectar com o `sdb`, gerar o pacote
com `tizen build-web`, assinar com `tizen package -s <seu-perfil>` e instalar com
`tizen install`. Consulte a referencia da CLI do Tizen Studio para a sintaxe
exata dos comandos. A assinatura usa o mesmo perfil de certificado criado no
Passo 5.

## Solucao de problemas

- A TV nao conecta no Device Manager: confirme que PC e TV estao na mesma rede,
  que o Developer Mode esta ligado com o IP do PC correto, e que a TV foi
  reiniciada. A porta e 26101.
- Erro de assinatura ao empacotar: confirme que o perfil de certificado esta
  ativo no Certificate Manager e que o DUID informado e o da TV de destino.
- Instalou em uma TV mas nao instala em outra: comportamento esperado. O
  certificado e amarrado ao DUID. Gere um novo certificado com o DUID da outra
  TV.

## Resumo

- O certificado de distribuidor e amarrado ao DUID da TV, entao cada TV precisa
  do proprio certificado.
- Nao e possivel distribuir um `.wgt` pronto que instale em qualquer TV por este
  caminho (sideload).
- A publicacao pela loja Samsung, que dispensaria o certificado por aparelho,
  esta em avaliacao futura.

## Referencias

- Samsung Developers, Creating Certificates:
  https://developer.samsung.com/smarttv/develop/getting-started/setting-up-sdk/creating-certificates.html
- Samsung Developers, TV device (Developer Mode):
  https://developer.samsung.com/tv/develop/getting-started/using-sdk/tv-device
