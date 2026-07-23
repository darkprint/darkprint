# DarkPrint.io — Note di progetto

## 1. Cos'è una Dark Factory
Il termine nasce dal manifatturiero: una fabbrica così automatizzata da non aver più bisogno di luci, perché non ci sono operai, solo macchine che lavorano da sole. Applicato agli agenti AI, indica una pipeline dove agenti autonomi orchestrano l'intero processo — pianificazione, esecuzione, verifica, consegna — senza supervisione umana costante.

### Cosa la distingue da un normale workflow automatizzato
- **Autonomia decisionale**: un workflow tradizionale ha checkpoint di approvazione umana; una dark factory prende anche le decisioni di giudizio (es. come correggere un errore) senza fermarsi.
- **Ciclo chiuso**: gli agenti pianificano, eseguono, verificano e spediscono il risultato in autonomia, invece di seguire una sequenza fissa predefinita.
- **Spostamento del lavoro umano**: l'ingegnere non scrive più codice riga per riga ma specifiche e criteri di accettazione. Il debito tecnico si sposta in "debito di specifica".

## 2. Il progetto: darkprint.io
Side project: un sito dove le persone possono caricare i blueprint (grafi, es. DOT per Attractor) delle proprie dark factory.

- Nomi valutati: dark factory.design, darkforge, blueprintsai, darkprint.ai → **scelto: darkprint.io**
- Autenticazione semplice: username/password, profilo utente base
- Target primario: sviluppatori e ricercatori già nel mondo di agenti AI/orchestrazione (nicchia tecnica)
- Estensione prevista: rendere i blueprint utilizzabili anche da utenti non tecnici (es. chi scrive libri, fa amministrazione) tramite Claude Code come layer di traduzione — l'utente descrive l'obiettivo in linguaggio naturale e l'agente configura/installa il blueprint senza esporre grafo o dettagli tecnici

## 3. Contenuti caricabili sul sito
- **Blueprint**: grafo completo di una dark factory (titolo, descrizione, file, tag/categoria, autore, note tecniche su agenti/strumenti richiesti)
- **Part**: sottografi/componenti riutilizzabili (es. nodo di retry, nodo di validazione, nodo di negoziazione tra agenti) da inserire in un blueprint più grande — concetto simile ai package npm ma per logica di orchestrazione
- **Ontologie**: sezione dedicata alle ontologie per l'ecoding di informazioni in strutture a grafo. (i.e., definizione nodi e vertifici)

## 4. Sistema di validazione e punteggio
Scheda a 6 metriche per ogni blueprint:
1. **Livello di autonomia** (1–4)
2. **Efficacia**
3. **Affidabilità** (esecuzioni ripetute senza errori)
4. **Trasparenza** (documentazione delle scelte interne)
5. **Costo/tempo di esecuzione**
6. **Sicurezza** (permessi e accessi richiesti)

Come vengono calcolate:
- Autonomia e sicurezza → analisi statica automatica del grafo (nodi di approvazione umana, gate manuali)
- Costo/tempo → misurati oggettivamente quando qualcuno fa girare il blueprint
- Efficacia, affidabilità, trasparenza → votate dalla community

Telemetria: opt-in esplicito richiesto all'utente quando fa girare un blueprint in locale, per inviare dati alla piattaforma (con incentivo tipo punti reputazione).

Validatori: badge/reputazione che dà più peso ai loro voti; possibile accesso anticipato a funzionalità premium come ricompensa.

## 5. Interfaccia prevista
- Homepage a galleria (titolo, tag, punteggio autonomia, miniatura del grafo)
- Pagina di dettaglio per singolo blueprint (6 metriche, file scaricabile, commenti community)
- Profilo utente (blueprint caricati, badge validatore)

## 6. Monetizzazione
- Freemium: download illimitati, blueprint privati, statistiche avanzate come funzionalità a pagamento
- Commissione su blueprint premium venduti (modello tipo Envato)
- Sponsorizzazioni da aziende di orchestrazione/cloud che vogliono promuovere i propri strumenti tramite blueprint in evidenza (marketing travestito da utilità, come fanno AWS/Hugging Face con i template gratuiti)


## 7. Esempi di blueprint da caricare per primi
Scartata l'idea di esempi troppo banali (estrazione testo, revisione codice). Preferibili esempi che mostrano i problemi tecnici reali delle dark factory:
- Gestione del conflitto tra agenti (negoziazione/voto quando due agenti producono risultati contrastanti)
- Recupero automatico da un fallimento a metà pipeline senza perdere il lavoro già fatto

