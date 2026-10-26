Bentora
Leia. Reflita. Guarde o que importa.

Sua biblioteca pessoal e seu diário inteligente de leitura.

O Bentora é um aplicativo de leitura, reflexão e aprendizado ativo. Seu objetivo é ajudar leitores a organizar seus livros, acompanhar suas leituras e registrar ideias, dúvidas e aprendizados — conectando a experiência de leitura à reflexão pessoal.

O projeto está sendo desenvolvido como aplicação de portfólio para a graduação em Bacharelado em Sistemas de Informação (BSI), com desenvolvimento gradual e foco em compreender as decisões técnicas e o funcionamento do código.
Sobre o projeto
O Bentora não pretende ser apenas um leitor de livros digitais ou um aplicativo para marcar páginas lidas. Sua proposta é reunir três experiências:
- Leitura: ler arquivos digitais ou acompanhar livros físicos e livros abertos em outros dispositivos.
- Reflexão: registrar pensamentos, opiniões, dúvidas e aprendizados relacionados às leituras.
- Aprendizado ativo: usar perguntas e recursos de inteligência artificial para explorar o conteúdo, revisar ideias e aprofundar interpretações.
Essas experiências devem funcionar de forma integrada, compartilhando informações sobre os livros, o progresso de leitura e os registros pessoais.
Diferencial
O principal diferencial do Bentora é o diário inteligente de leitura, integrado à biblioteca pessoal e a recursos de IA.

A proposta é ajudar o leitor não apenas a terminar um livro, mas também a compreender, recordar e aproveitar melhor aquilo que leu. A IA deve estimular a análise e o pensamento crítico, sem decidir pelo usuário o que ele deve pensar.
Funcionalidades previstas
Biblioteca e acompanhamento de leitura
- Organizar livros em Quero ler, Lendo e Concluídos.
- Pesquisar livros em catálogos externos, como Google Books ou Open Library.
- Cadastrar livros manualmente.
- Consultar os detalhes de cada livro.
- Registrar páginas, capítulos e progresso de leitura.
- Registrar datas de início e conclusão e consultar o histórico.
- Associar reflexões e perguntas a livros específicos.
O acompanhamento não depende de o usuário ler dentro do Bentora. Também deverá ser possível registrar o progresso de livros físicos, Kindle ou outros leitores, de forma manual.
Leitor integrado
A visão do projeto inclui importar e abrir arquivos PDF e EPUB no próprio aplicativo, retomar a leitura de onde parou e relacionar reflexões ao livro e, quando possível, ao capítulo ou trecho.

O leitor inicial permite importar um arquivo PDF ou EPUB nos detalhes de um livro. O arquivo fica no armazenamento privado do aplicativo; PDF.js e EPUB.js renderizam o conteúdo localmente em uma WebView. A posição é salva automaticamente: página no PDF e trecho/posição no EPUB. Arquivos protegidos por senha ou incompatíveis podem não abrir. O leitor requer um arquivo compatível associado ao livro e não acessa catálogos externos.

Os runtimes compilados do leitor ficam em `assets/reader/`. Após atualizar as dependências PDF.js ou EPUB.js, regenere-os com `npm run build:reader`. Os avisos de licença das bibliotecas usadas estão junto aos runtimes.

A implementação e a escolha das bibliotecas serão avaliadas considerando compatibilidade com React Native, Expo e iOS, desempenho, manutenção, extração de texto e licenciamento.
Diário de leitura
O diário permitirá registrar pensamentos, opiniões, dúvidas, interpretações e ideias que surgirem durante a leitura.

Funcionalidades previstas:
- Criar, editar e excluir reflexões.
- Associar uma reflexão a um livro.
- Informar a página ou capítulo relacionado.
- Consultar reflexões de um livro e pesquisar registros anteriores.
Perfil e atividade de leitura
A aba Perfil mantém um nome local, resume páginas e tempo de leitura registrados, mostra conquistas básicas e reúne um feed privado de leituras e reflexões. Ao salvar o progresso de um livro, o leitor pode registrar páginas avançadas e minutos dedicados à sessão.

O Perfil permite criar conta e entrar com e-mail e senha pelo Supabase Auth. Para configurar o projeto, copie `.env.example` para `.env` e informe `EXPO_PUBLIC_SUPABASE_URL` e `EXPO_PUBLIC_SUPABASE_PUBLISHABLE_KEY`. Use somente uma chave publicável; nunca coloque a chave `service_role` no app. Após editar `.env`, reinicie o Expo para carregar a configuração.

A autenticação confirma a identidade, mas ainda não sincroniza livros e reflexões: esses dados continuam salvos localmente neste aparelho. A confirmação de e-mail depende das opções configuradas no painel do Supabase.

O Diário também permite ditar uma reflexão. O app grava em M4A no iOS/Android e WebM na web, envia o áudio à Edge Function autenticada `transcribe-reflection`, e insere o texto devolvido para revisão. A função encaminha a gravação à API de transcrição da OpenAI e não salva o arquivo. Para ativá-la, cadastre `OPENAI_API_KEY` em **Supabase Dashboard → Edge Functions → Secrets** e publique a função com `npx supabase login`, `npx supabase link --project-ref SEU_PROJECT_REF` e `npx supabase functions deploy transcribe-reflection`. A chave da OpenAI nunca deve entrar no `.env` do app.
Perguntas inteligentes
A IA deverá oferecer diferentes formas de explorar uma leitura:
- Sobre capítulos lidos: perguntas para verificar compreensão, identificar argumentos e explorar relações e interpretações.
- Sobre reflexões pessoais: perguntas que ajudem a examinar e aprofundar as ideias registradas.
- Sobre o livro e as reflexões: perguntas que conectem o conteúdo disponível da obra às interpretações do leitor.
A experiência planejada é interativa: o usuário escolhe o livro, os capítulos e o tipo de pergunta; responde a uma pergunta por vez; recebe comentários e pode continuar, pular ou encerrar a sessão.

As perguntas devem se basear no conteúdo disponível. Quando o Bentora não tiver acesso ao capítulo, deverá informar essa limitação e oferecer alternativas, como utilizar as reflexões do próprio usuário.
Revisão e retenção do conhecimento
Como evolução futura, o Bentora poderá permitir revisitar reflexões, refazer perguntas, comparar interpretações ao longo do tempo, identificar temas recorrentes e sugerir revisões com base no histórico de aprendizagem.
Escopo inicial (MVP)
A primeira versão deverá priorizar uma experiência útil e possível de implementar e testar gradualmente:
1. Cadastro e organização dos livros.
2. Acompanhamento manual do progresso, independentemente do formato de leitura.
3. Diário de reflexões em texto.
4. Associação de reflexões a livros e capítulos.
5. Avaliação e implementação do leitor PDF/EPUB, conforme viabilidade técnica.
6. Perguntas inteligentes baseadas nos insights, evoluindo para o conteúdo dos livros quando disponível.
Sincronização entre dispositivos, estatísticas avançadas e revisões automáticas poderão ficar para etapas posteriores. Se o leitor integrado atrasar a entrega, o acompanhamento manual deverá continuar funcionando.
Tecnologias
Tecnologias e integrações previstas para o projeto:
- React Native — desenvolvimento mobile.
- Expo — configuração e desenvolvimento.
- TypeScript — tipagem e organização do código.
- React Navigation — navegação entre telas.
- Expo SQLite — armazenamento local de livros, reflexões, progresso e histórico.
- Google Books API ou Open Library API — pesquisa em catálogos externos.
- Bibliotecas de PDF e EPUB — leitura de arquivos no aplicativo.
- Serviço de inteligência artificial — organização de reflexões e geração de perguntas.
- Backend seguro — intermediar chamadas a serviços externos quando necessário.
A seleção das bibliotecas de PDF e EPUB deverá considerar compatibilidade com Expo e iOS, desempenho, manutenção e licenciamento. Chaves secretas de APIs não devem ser armazenadas diretamente no código do aplicativo.
Organização do código
A estrutura será organizada conforme o projeto evoluir. Uma organização sugerida:
src/
├── navigation/  # Configuração da navegação
├── screens/     # Telas do aplicativo
├── components/  # Componentes reutilizáveis
├── services/    # APIs e serviços externos
├── database/    # Banco de dados e consultas
├── types/       # Tipos e interfaces TypeScript
└── theme/       # Cores, espaçamentos e estilos globais
Essa estrutura é uma referência e poderá ser adaptada à organização real do código.
Privacidade e segurança
Como o Bentora poderá armazenar reflexões pessoais, documentos e gravações, a privacidade deve ser considerada desde o início.

Princípios do projeto:
- Manter dados localmente sempre que adequado.
- Informar quando conteúdos forem enviados a serviços externos.
- Enviar apenas os trechos necessários para processamento por IA.
- Solicitar autorização antes de salvar textos produzidos ou revisados pela IA.
- Não manter gravações de áudio após o processamento.
- Permitir editar e excluir reflexões.
- Proteger credenciais e chaves de API.
- Considerar backup e recuperação de dados em etapas futuras.
O aplicativo deverá respeitar os direitos de uso dos arquivos importados e não distribuir cópias não autorizadas de obras protegidas por direitos autorais.
Desenvolvimento
O projeto será desenvolvido em etapas pequenas, com testes antes de avançar:
1. Preparação do ambiente e navegação inicial.
2. Biblioteca e banco de dados local.
3. Detalhes do livro e progresso de leitura.
4. Avaliação e implementação do leitor integrado.
5. Diário de reflexões.
6. Perguntas inteligentes.
7. Perfil local, conquistas básicas e feed de atividade.
8. Testes, aprimoramentos, documentação e preparação para o portfólio.
Cada funcionalidade deverá ser validada antes de iniciar a próxima, preservando o que já funciona e registrando as decisões técnicas.
Como executar
Nota: complete esta seção com os comandos e requisitos confirmados no ambiente atual do projeto. Eles podem variar conforme a versão do Expo e as dependências instaladas.

Em um ambiente com Node.js e npm instalados:
npm install
npx expo start
Para testar no iPhone, abra o projeto pelo Expo Go, conforme a configuração de desenvolvimento utilizada.
Estado do projeto
O Bentora está sendo construído de forma incremental. A proposta, o nome, o slogan e as principais funcionalidades foram definidos em nível inicial. O código e este README devem ser atualizados conforme novas funcionalidades forem concluídas e testadas.
Próximas melhorias
- Completar os fluxos da biblioteca e dos detalhes do livro.
- Desenvolver o diário de reflexões em texto.
- Avaliar as opções técnicas para PDF e EPUB.
- Planejar a integração com IA com atenção à confiabilidade, privacidade e segurança.
- Registrar limitações conhecidas e decisões técnicas.
Visão de longo prazo
O Bentora busca ser um espaço pessoal onde o leitor reúna seus livros, registre o que pensa, explore o que aprendeu e revisite suas ideias ao longo do tempo.

O usuário poderá ler onde preferir, acompanhar seu progresso no Bentora, registrar insights e conversar com uma IA que utilize o conteúdo disponível do livro e as reflexões pessoais para estimular uma leitura mais ativa.

O objetivo não é substituir a experiência de leitura nem dizer ao usuário o que pensar, mas oferecer ferramentas para que desenvolva sua própria compreensão, preserve ideias importantes e construa um histórico pessoal de aprendizado.
Bentora — Leia. Reflita. Guarde o que importa.
