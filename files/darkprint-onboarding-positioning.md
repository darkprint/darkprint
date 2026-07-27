# DarkPrint — Documento 2: posizionamento, onboarding e distribuzione

> Complementare a `darkprint-design.md`, che copre il modello dati (card nodo, DOT, versionamento, archivio, ontologia, metriche, deployment). Questo documento copre come si spiega, come si impara, come si trova e come si distribuisce.
> Le sezioni sono numerate per essere referenziate in Claude Code ("implementa §5.3").
> Stato: alcune scelte sono **decise**, altre sono **raccomandazioni** o **aperte**, segnalate come tali.

---

## 0. Il problema da risolvere

Feedback raccolto da un tester: chi non conosce le dark factory **non capisce il sito**. Alla fine si è basato sulla spiegazione a voce dell'autore, non su ciò che leggeva. Mancano un claim iniziale forte e un percorso "come ne creo una".

Due cause, e sono strutturali:

1. Il sito **definisce il concetto prima di far localizzare il lettore**. Chi arriva non sa dove si trova rispetto a quello che gli stai descrivendo.
2. Due onboarding diversi sono trattati come uno solo.

| | Onboarding concettuale | Onboarding pratico |
|---|---|---|
| Per chi | visitatore freddo | già convinto |
| Domanda | cos'è e perché mi riguarda | come ne costruisco una |
| Durata | 30 secondi | ~1 ora |
| Dove | landing (§2) | percorso guidato (§5) |

**Decisione: tenerli fisicamente separati.** Mescolati, il primo diventa troppo lungo e il secondo troppo vago.

---

## 1. Posizionamento

DarkPrint è una **galleria/registry di blueprint di dark factory**, con l'MCP come canale aggiuntivo di accesso, non come prodotto principale.

Una dark factory copre **cinque fasi**: planning, implementation, testing, debugging, deployment. Il nome viene dalle fabbriche completamente automatizzate (FANUC): si chiamano *dark* perché le luci sono spente, gli umani non servono in produzione.

**Claim principale (già validato nelle note):**

> Specifications go in. Software comes out.

Funziona perché dice cosa entra e cosa esce senza gergo.

**Il gancio argomentativo**, da usare subito dopo il claim: il gap tra il livello 2 (AI-assisted: prompti, revisioni, mergi) e il livello 4 (autonomo) **non è tecnologico, è architetturale e organizzativo**. La tecnologia per arrivare al livello 4 esiste già. Quello che manca sono i pattern per strutturare il lavoro.

Questa frase fa tutto il lavoro di posizionamento: dice al lettore che il suo problema è di design, e il design è esattamente ciò che il sito raccoglie.

**Riferimenti da citare/linkare:**
- HackerNoon, "The Dark Factory Pattern: Moving from AI-Assisted to Fully Autonomous Coding"
- Bluegrid, "AI Dark Factory Pattern part 1: what is it and isn't" (livelli 1-4)
- Il caso StrongDM come esempio operativo

### 1.1 Principio: l'autonomia è una descrizione, non un voto

**Un blueprint non deve essere completamente autonomo per avere valore su DarkPrint.** Un grafo con un nodo di intervento umano è legittimo e benvenuto. Prende semplicemente un punteggio che indica che non è completamente autonomo, e quel punteggio è **descrittivo, non qualitativo**.

Questo è un principio di prodotto, non un dettaglio di copy: la barriera d'ingresso più probabile per un sito come questo è che qualcuno guardi la propria pipeline, veda un passaggio manuale, e concluda di non essere abbastanza avanti per pubblicare.

**Conseguenze vincolanti sull'interfaccia:**

- Nella galleria l'autonomia è un **filtro**, non un ordinamento di merito. Nessuna classifica implicita in cui 4 sta sopra 1.
- Nessun linguaggio valutativo attorno al numero. Si scrive *autonomia livello 2*, mai *2 su 4* con una barra di progresso che suggerisce un vuoto da riempire.
- L'indicatore di autonomia mostra **dove sono gli interventi umani**, non quanto manca alla piena autonomia. È informazione utile a chi valuta il blueprint, non una pagella all'autore.
- Nessun badge o incentivo che premi l'autonomia alta di per sé. La reputazione si guadagna sulla qualità e sull'uso, non sul livello di automazione.
- Anche la copertura di fase (§8) segue la stessa regola: coprire tre fasi su cinque è una descrizione, non un difetto.

**Attenzione a una tensione nel copy della landing.** Il gancio sui livelli 1-4 (§1) implica che il livello 4 sia la destinazione. Va tenuto distinto dal punteggio del singolo blueprint:

> I livelli descrivono la **maturità di un'organizzazione**, cioè cosa è in grado di fare. Il punteggio di autonomia descrive una **scelta di design su un singolo blueprint**, cioè cosa quella fabbrica ha deciso di automatizzare e cosa no.

Sono due cose diverse e il testo non deve confonderle, altrimenti il sito predica l'apertura e poi mette in imbarazzo chi pubblica un grafo con un umano dentro.

---

## 2. Landing page

### 2.1 La scala, in sei gradini

L'ordine non è "definizione poi esempi". È: **localizza, poi definisci**.

1. **Claim.** *Specifications go in. Software comes out.*
2. **Ancoraggio.** La fabbrica al buio. Una riga, e il nome del sito diventa autoesplicativo.
3. **Autolocalizzazione.** I livelli 1-4, girati verso il lettore: "oggi sei probabilmente al livello 2". Poi la frase sul gap architetturale (§1).
4. **Un esempio concreto, singolo, visibile.** Una dark factory vera, il grafo mostrato, il blueprint aperto. **Uno, non tre.**
5. **Cosa non è.** Il confronto con le Skill (§3).
6. **Due porte.** *Sfoglia i blueprint* oppure *costruisci il tuo* (→ §5).

### 2.2 Hero animato: la fabbrica e il suo blueprint

**Concetto.** L'oggetto dietro il logo esiste in **due stati**, e lo scroll è la transizione tra i due:

| Stato | Aspetto | Label visibile |
|---|---|---|
| Alto della pagina | fabbrica solida, tridimensionale | `dark factory` |
| Scrollando in giù | wireframe / disegno tecnico | `blueprint` |

Scrollando in giù sparisce la label `dark factory` e resta `blueprint`. Scrollando in su avviene l'inverso. La stessa cosa in due stati: **la fabbrica e la sua stampa**. La hero dimostra letteralmente il nome del sito.

**Estensione consigliata (opzionale ma forte):** la silhouette della fabbrica è **composta dai cinque nodi** del blueprint starter. In alto legge come un edificio; scrollando si scompone e risolve nel grafo a cinque fasi che l'utente costruirà nel tutorial. Hero, tutorial e prodotto diventano lo stesso oggetto.

### 2.3 Implementazione: due strade

Libreria di animazione: **anime.js** (richiesta esplicita).

> Nota per l'implementazione: anime.js v4 ha cambiato API rispetto alla v3 (`import { animate, createTimeline } from 'animejs'` invece di `anime({...})`). Verificare la versione installata prima di scrivere il codice.

anime.js orchestra timeline e proprietà, **non è un motore 3D**. Quindi la scelta vera è come si ottiene lo stato tridimensionale.

**Strada A: SVG isometrico + anime.js (raccomandata)**

Fabbrica disegnata come SVG isometrico su due layer sovrapposti: uno pieno, uno di sole linee. La transizione è un crossfade di opacità più un effetto di tracciamento delle linee via `stroke-dashoffset`.

Vantaggi: nessun WebGL, leggerissima, funziona ovunque, batteria salva su mobile, facile da implementare correttamente. E l'estetica del disegno tecnico isometrico è **più on-brand** per un sito di blueprint di un modello 3D renderizzato.

**Strada B: Three.js + anime.js**

Geometria 3D vera, con anime.js che pilota la timeline legata allo scroll (camera, opacità, rotazione).

⚠️ **Trappola tecnica da evitare:** non usare `material.wireframe = true`. Disegna ogni triangolo della mesh, comprese le diagonali dei quadrilateri, e il risultato sembra una mesh poligonale, non un blueprint. Per linee pulite serve `EdgesGeometry` + `LineSegments`, che disegna solo gli spigoli sopra una soglia angolare.

**Raccomandazione: strada A**, a meno che non si voglia rotazione e profondità reali. Per un side project è più veloce da portare a casa e visivamente più coerente.

### 2.4 Vincoli tecnici obbligatori

- **Lo scroll pilota una timeline in seek, non triggera animazioni.** Costruire una timeline anime.js e chiamare `seek(progress * duration)`. Le animazioni triggerate sugli eventi di scroll si accavallano e scattano.
- **`IntersectionObserver` + `requestAnimationFrame`**, mai un listener di scroll che scrive stile a ogni evento.
- **Rispettare `prefers-reduced-motion`**: stato statico, nessuna transizione.
- **Le label `dark factory` e `blueprint` sono testo nel DOM**, animate in opacità. Non vanno disegnate dentro canvas o SVG, perché devono restare leggibili dai crawler (§7.3).
- **L'`h1` resta testo reale.** La hero animata non deve sostituire il contenuto testuale indicizzabile.
- **Fallback mobile**: versione statica o semplificata. Una hero WebGL su mobile è un costo di batteria che non ripaga.

### 2.5 Copy guidelines

Ripulire tutto il testo del sito dai pattern di scrittura AI: costruzioni "non X, ma Y", trattini lunghi usati come pausa, triplette ritmiche, enfasi vuote. Il target sono sviluppatori, che li riconoscono e li penalizzano.

---

## 3. Cosa non è: il confronto con le Skill

Va in landing (§2.1, gradino 5) e in una pagina di recap dedicata.

**Una Skill dà una capacità a un agente. Una dark factory è l'architettura di più agenti, e soprattutto è l'insieme delle regole di isolamento tra loro.**

L'esempio che dimostra la differenza meglio di qualsiasi definizione:

> Chi scrive il codice non deve mai vedere i test di accettazione. Se li vede, li aggira. E il modello che ha prodotto la modifica è lo stesso che ti dice che va bene, il che è il problema: gli LLM sono troppo inclini ad accordarsi con i propri turni precedenti e troppo disposti a dichiarare vittoria su qualcosa che hanno appena prodotto. Generazione e validazione devono essere completamente isolate.

Questa regola **non è esprimibile come una skill**. È una proprietà della **topologia**: di chi è collegato a chi, e soprattutto di chi è tagliato fuori da cosa.

Due motivi per cui questa sezione conta più di quanto sembri:

1. Chiarisce la differenza meglio di ogni definizione astratta.
2. **Giustifica l'intero impianto del sito.** Se il valore sta nella struttura, allora un repository di grafi ha senso e un repository di prompt no. Il modello dati e il posizionamento si tengono a vicenda, e va detto esplicitamente.

**Serve una pagina di recap delle componenti** (blueprint, nodo, ontologia, fase) che spieghi cosa sono e come si distinguono tra loro.

---

## 4. Quali task sono adatti

Pagina breve, ma è la domanda che il tester ha posto e a cui nessuno risponde mai.

**Adatto se:**
- il risultato è verificabile automaticamente
- esiste già una suite di test, o si può scrivere
- lo scope è delimitato
- sbagliare costa poco, si può iterare

**Non adatto se:**
- i requisiti sono ambigui
- solo un umano può dire se il risultato è giusto
- un errore finisce direttamente in produzione su qualcosa di critico

Questa pagina fa anche da **filtro**: evita che qualcuno provi su un task impossibile e concluda che le dark factory non funzionano.

---

## 5. Il percorso guidato e lo starter blueprint

Il cuore dell'onboarding pratico. Alla fine l'utente ha una dark factory **sua, scaricabile e funzionante**.

Tra le opzioni valutate (pagina statica, simulazione in landing, tutorial guidato), la simulazione pura è scartata: costosa da costruire e non dimostra nulla, perché mostra un'animazione. Serve il momento "funziona davvero", e quello lo produce solo un artefatto eseguibile.

### 5.1 Ordine pedagogico: intero → parte → intero

**Non partire dal template del nodo.** Una card vista a freddo è un file YAML con dei campi; non significa nulla finché non si sa in cosa si incastra.

1. **La fabbrica intera.** Cinque nodi, uno schermo, grafo completo. "Questa è una dark factory. Fa questo. Ora smontiamola."
2. **Un nodo solo.** Zoom sul `builder`. Ecco la card, i quattro blocchi (§3 del documento 1), perché ognuno c'è. Ora il template ha un contesto.
3. **Si ricompone e cresce.** L'utente modifica, il grafo si complica, le regole di composizione tengono.

#### La vista sincronizzata a quattro riquadri

Il meccanismo didattico centrale del percorso. **Il sito non simula l'esecuzione** (quella avviene sulla macchina dell'utente, §0.1.3 del documento 1): il sito mostra la **corrispondenza tra le quattro rappresentazioni della stessa cosa**.

| Riquadro | Contenuto |
|---|---|
| 1 | Il **grafo** renderizzato |
| 2 | Lo **scheletro del nodo** selezionato, cioè i quattro blocchi vuoti con le etichette |
| 3 | Il **file DOT**, la topologia |
| 4 | Il **file YAML** della card selezionata |

**Comportamento richiesto: la selezione è sincronizzata in tutti e quattro i riquadri.** Cliccando un nodo nel grafo si evidenzia la riga corrispondente nel DOT, si apre la sua card YAML, e lo scheletro mostra quali campi quella card riempie. La selezione funziona in tutte le direzioni: cliccare una riga del DOT o un campo del YAML evidenzia il nodo nel grafo.

Perché è la scelta giusta, e perché batte una simulazione animata:

- Il modello dati è la cosa che l'utente **deve** capire per scrivere le proprie fabbriche. Un'animazione di un'esecuzione non lo insegna; la corrispondenza sì.
- Toglie il salto concettuale tra "vedo un disegno" e "ho scaricato dei file di testo". Sono la stessa cosa, e l'utente lo vede.
- È il momento in cui l'**arco mancante** (§5.2) diventa dimostrabile su tre rappresentazioni contemporaneamente: assente nel disegno, assente nel DOT, assente dalla `spec` della card.
- È molto meno costosa da costruire di un simulatore di esecuzione, e non può mentire su cosa farà davvero il blueprint.

Lo stesso componente si riusa poi nella pagina di dettaglio di ogni blueprint della galleria. Non è un pezzo usa e getta del tutorial.

### 5.2 I cinque nodi, una fase ciascuno

| # | Nodo | Fase | Ruolo |
|---|---|---|---|
| 1 | `planner` | planning | specifica → piano + criteri di accettazione |
| 2 | `builder` | implementation | piano → codice. **Non vede mai i criteri** |
| 3 | `tester` | testing | esegue davvero → verdetto + **evidenze di fallimento** |
| 4 | `debugger` | debugging | codice + evidenze → **patch mirata** |
| 5 | `deployer` | deployment | gate e rilascio |

**La lezione centrale non sta in un nodo, sta in un arco che non c'è.** Dai criteri di accettazione al `builder` non esiste collegamento. Nel tutorial quell'arco mancante va **evidenziato visivamente**: è la cosa che nessun repository di prompt può esprimere.

### 5.3 Le tre scelte che restano

Distinzione fondamentale: ci sono **scelte che restano nell'artefatto** e **interruttori che insegnano** (§5.4). Non vanno mescolati. Ogni combinazione di scelte deve produrre una fabbrica **funzionante**: se rendi persistente una configurazione rotta, spedisci a qualcuno una fabbrica difettosa col tuo marchio sopra.

**Scelta 1 — cosa costruisce la tua fabbrica?**
Quattro opzioni: script Python, componente React, trasformazione dati, documentazione.
Non muove metriche, non cambia la topologia, cambia il contenuto delle card. Serve a due cose: è la domanda più facile, quindi scalda senza spaventare; e rende l'artefatto **suo**. Chi finisce non ha scaricato l'esempio del sito, ha scaricato la sua fabbrica. Va per prima.

**Scelta 2 — chi decide che il lavoro è finito?**
Il `tester` da solo, oppure un umano che approva prima del merge.
Lezione sull'**autonomia**, e prima volta in cui il punteggio si muove: 4 contro 3, con indicazione del nodo esatto che l'ha fatta scendere.
⚠️ Il punto didattico non è "scegli 4". È che **più autonomia non è automaticamente meglio**: se la fabbrica tocca qualcosa di critico, quel nodo umano lo vuoi. Va detto, altrimenti insegni a ottimizzare un numero invece che a progettare.

Questa è anche la prima occasione in cui il sito comunica il principio di §1.1. Chi sceglie l'approvazione umana non deve vedere niente che somigli a una penalità: vede il grafo cambiare, il punteggio cambiare, e una spiegazione neutra di cosa quella scelta comporta. Se il tutorial fa sentire in colpa chi mette un umano nel grafo, la §1.1 è persa prima ancora della pubblicazione.

**Scelta 3 — quante iterazioni di debug prima di arrendersi?**
Un cursore, es. da 1 a 10 (vedi §5.5).

### 5.4 L'interruttore che insegna

**"Il `builder` può vedere i criteri di accettazione?"**

Non è una scelta, è una **dimostrazione**. Va collocata nel momento in cui si zooma sulla coppia builder/tester, cioè quando l'arco mancante è sotto gli occhi.

L'utente lo attiva → l'arco compare → **la sicurezza crolla** → il sito spiega perché (§3) → si rimette com'era e si prosegue.

Nessuno lo lascerebbe attivo, per questo non può essere una scelta persistente. Ma vederlo rompersi vale dieci volte più che leggerlo.

### 5.5 Il loop di debugging (il finale del percorso)

Il loop è `tester → debugger → tester`. **Non torna al `builder`.**

Due motivi indipendenti che si rinforzano:
1. Si preserva il lavoro fatto e si converge, invece di rigenerare da zero e oscillare.
2. Il `builder` resta **isolato per sempre** dalle informazioni sui fallimenti.

**Il punto fine da spiegare in pagina.** Obiezione naturale: se il generatore non deve vedere i criteri, perché il debugger può vedere i fallimenti?

> Vedere **i criteri** permette di scrivere codice costruito apposta per passarli senza risolvere il problema. Vedere **le evidenze di un fallimento che hai causato** dice solo cosa si è rotto. Il primo è gaming, il secondo è feedback.

Regola implementativa: il `debugger` riceve stack trace, asserzioni fallite, atteso contro ottenuto. **Non** l'insieme completo dei criteri. Se glieli passi tutti, ricomincia a fare special-casing.

**Secondo livello, ottimo materiale per un hint of the week:** su molte iterazioni il debugger può **ricostruire i criteri accumulando messaggi di errore**. Ogni giro gli rivela un pezzo della superficie di accettazione. Quindi il tetto di iterazioni non serve solo a evitare il loop infinito, serve a **limitare quanta informazione trapela**.

**Tre requisiti perché il loop sia sano**, tutti da configurare in questo passaggio:
- **Tetto di iterazioni.** Senza, è un ciclo senza condizione d'uscita, uno dei marcatori di rischio dell'ontologia.
- **Via di escalation.** Esaurito il tetto non si fallisce e basta: si risale al `planner` (il piano era sbagliato) oppure si ferma e si chiama un umano.
- **Criterio di progresso.** Se dopo due giri i fallimenti sono identici, il debugger gira a vuoto: fermarsi prima del tetto.

### 5.6 Le metriche come strumento didattico

Le scelte precedenti insegnano autonomia e sicurezza. **Il loop insegna costo e tempo**, perché il loop è esattamente il punto dove il costo esplode.

Alzando il cursore del tetto da 3 a 10:
- la stima di **costo** e **tempo** sale
- l'**autonomia** sale
- la **sicurezza** scende

Tre metriche che si muovono insieme su un solo cursore. L'utente capisce in dieci secondi che progettare una dark factory è un **compromesso**, non un'ottimizzazione. È la cosa più difficile da trasmettere a parole, e qui la si trasmette con un cursore.

Per questo il loop va **in fondo al percorso**: non come appendice, ma come momento in cui tutto converge.

### 5.7 Vincoli implementativi

- **Le varianti strutturali sono 8** (4 tipi di output × 2 modalità di approvazione). Il tetto di iterazioni è un parametro numerico e **non cambia la topologia del grafo**, quindi non moltiplica i casi da testare. Tutte e 8 devono produrre una fabbrica scaricabile e funzionante. Da esplicitare, altrimenti si testano i percorsi principali e i restanti si rompono in silenzio.
- **Il pannello dei punteggi resta sempre visibile** durante le scelte. Se sparisce, il ciclo di feedback si spezza e le scelte tornano a essere un form burocratico.
- **Le scelte si fanno dentro la vista del grafo**, cliccando sul nodo interessato, non in un form laterale. Il grafo è l'interfaccia, non l'illustrazione, perché è la stessa cosa che l'utente userà dopo per costruire le sue fabbriche vere.

### 5.8 La Skill

La "skill per imparare a usare una dark factory" presente nelle note **è questo stesso tutorial, impacchettato per Claude**. Stessa sostanza, canale di distribuzione diverso. Non progettarla come artefatto separato.

---

## 6. Registrazione e ciclo di attivazione

Il punto fragile: l'utente scarica, esce dal sito, gira nel suo terminale, e lì lo perdi. **Il ritorno va progettato, non sperato.**

### 6.1 Tempistica: registrarsi per salvare, non per scaricare

Non chiedere l'account per il download. Chiederlo per **salvare**:

> Questa è tua. Crea un account per tenerla nel tuo profilo come tuo primo blueprint.

Registrazione motivata dal possesso, non da un cancello. Converte molto meglio, e ha un effetto collaterale prezioso: **ti popola il sito**. Ogni utente che completa il tutorial produce un blueprint pubblicabile, quindi il problema della galleria vuota al lancio non esiste.

### 6.2 Come sai che ha funzionato

Due meccanismi, cumulabili:

1. **L'ultimo nodo dello starter riporta l'esito.** È esattamente la telemetria opt-in già prevista per misurare costo e tempo. Elegante perché **lo starter blueprint insegna la propria strumentazione mentre gira**.
2. **Codice di completamento**: l'esecuzione stampa un codice che l'utente incolla sul sito per sbloccare il badge.

### 6.3 Cosa sblocca la registrazione

- salvare i propri blueprint
- pubblicare, con toggle **pubblico/privato**
- votare le metriche soggettive
- accumulare reputazione dalla telemetria
- **collegare l'MCP** (§7)

### 6.4 Conseguenze del toggle privato (da non dimenticare, altrimenti diventano bug)

- I blueprint privati vanno **esclusi dall'indice di semantic search dell'MCP**.
- I blueprint privati vanno **esclusi dai conteggi d'uso** che fanno scattare la promozione di una voce dall'ontologia locale al nucleo (§7 del documento 1). Altrimenti si può influenzare il vocabolario comune con contenuti che nessuno può vedere.

---

## 7. MCP

### 7.1 Posizionamento nel percorso

L'MCP è **l'upgrade di chi ha già capito, non la porta d'ingresso**:

1. Primo giro: download semplice, nessun account, attrito zero.
2. "Questa è tua, salvala" → nasce l'account.
3. "La prossima volta non scaricare, collega Claude Code direttamente" → arriva l'MCP.

### 7.2 Dove va il link, in ordine di peso

**1. Pagina del singolo blueprint** (peso massimo, l'intento è al culmine). Accanto a Download e Fork, un tab *Use with Claude Code* con il comando pronto da copiare:

```
claude mcp add --transport http darkprint https://mcp.darkprint.io/mcp
```

e sotto il riferimento diretto con **versione pinnata**:

```
darkprint://blueprint/<id>@<version>
```

**2. Pagina dedicata `/mcp`**, linkata dalla nav. Spiega cosa fa il server, quali tool espone (search, fetch, run), istruzioni per Claude Code, Claude Desktop e altri client. Fa anche da documentazione indicizzabile.

**3. Landing**, sezione "come lo uso", come terza modalità dopo *sfoglia* e *scarica*. Una riga sola che rimanda a `/mcp`.

**4. Badge copiabile** in Markdown per il README dei repo degli autori, stile badge di CI. È solo un'immagine più un link, quindi funziona su qualsiasi host di repository: non introduce alcuna dipendenza da GitHub (doc 1 §0.1.4). Porta traffico qualificato a costo zero.

### 7.3 Discoverability

- **JSON-LD** sulle pagine blueprint per l'indicizzazione.
- **Google Search Console** per indicizzazione e ranking sugli LLM.
- **Vercel Analytics** per il tracking visite.

> **Il requisito "sito non scrapabile" è accantonato**, perché in conflitto diretto con SEO, ranking LLM e MCP: se un LLM deve indicizzarti e un server MCP deve servire i blueprint, stai per definizione dando accesso programmatico ai contenuti.
>
> **Vincolo per non incastrarsi:** non costruire nulla di attivamente anti-scraping (contenuto renderizzato solo via JS, offuscamento, blocchi user-agent), perché andrebbe smontato dopo. Mettere **rate limiting sulle API**, che serve comunque contro gli abusi. Il resto è coperto dal toggle privato: quello che non vuoi far girare, non lo pubblichi.

---

## 8. Le cinque fasi nell'ontologia

**Decisione: le cinque fasi diventano una dimensione di primo livello dell'ontologia**, accanto al tipo di nodo. Ogni nodo dichiara a quale fase appartiene.

```
phase: planning | implementation | testing | debugging | deployment
```

Tre benefici immediati:

1. Un **nucleo ontologico concreto** e subito utile, invece che astratto.
2. Una **copertura di fase** calcolabile per ogni blueprint, che diventa un badge nella galleria: *questa fabbrica copre planning, implementation e testing, non ha debugging né deployment*.
3. **Blueprint confrontabili** su una dimensione che significa qualcosa.

---

## 9. Distribuzione e contenuti

- **Gruppo Telegram** collegato al sito, pubblica il **blueprint della settimana**.
- **Medium / Substack**: il **DarkPrint del mese**.
- **Instagram**: contenuti visuali, i grafi si prestano.
- **Hint of the week**. Il primo è già scritto: l'isolamento tra generatore e validatore e il problema della sycophancy (§3). Il secondo può essere il leak dei criteri attraverso le iterazioni di debug (§5.5).

**Da valutare, rimandato:** il sito come portfolio pubblico di competenze. Il requisito minimo che lo abilita è già in §6.3: blueprint associati a un utente con scelta pubblico/privato.

---

## 10. Stack (aggiorna §9 del documento 1)

| Componente | Scelta |
|---|---|
| Front-end e deploy | Vercel, anteprima automatica per ogni PR |
| Analytics | Vercel Analytics |
| Auth, database, storage, vector search | **Supabase** (Auth, Postgres, Storage, `pgvector`) |
| Archivio blueprint e nodi | **Object storage indicizzato per hash**, **non Git** (doc 1 §5.1) |
| Formato blueprint | **DOT compatibile Attractor** (doc 1 §0.1.1) |
| Esecuzione blueprint | **macchina dell'utente**, via Claude Code o agente equivalente (doc 1 §0.1.3) |
| CI / test pre-deploy | GitHub Actions + Scaleway (flusso dell'autore, non del prodotto) |
| Monitoring uptime | uptimerobot |
| Animazioni landing | **anime.js** (§2.3) |
| Backend | servizio a processi lunghi per analisi grafo, istanziazione bundle, indicizzazione, telemetria |

---

## 11. Ordine di implementazione (sequenza unica)

> Questa è **l'unica sequenza di riferimento** per entrambi i documenti. Il §10 del documento 1 rimanda qui. Non seguire due liste separate.

**Fase 0 — prerequisiti, prima di scrivere codice**

0. **Verificare la specifica Attractor** e confermare che lo schema previsto vi rientri (doc 1 §0.1.1). Se non ci rientra, lo schema si adatta prima di essere implementato, non dopo.
1. **Ontologia v0.1** scritta a mano (file `darkprint-ontology-v0.1.md`). È il contratto da cui dipendono metriche, card e validatori. Se non la scrivi tu, se la inventa l'implementatore e poi te la ritrovi ovunque.
2. **File unico di configurazione** per tutte le soglie e i pesi ancora aperti (doc 1 §11).

**Fase 1 — il nucleo analizzabile**

3. **Schema della card nodo** (doc 1 §3) + validatore. Include il campo `spec` e le sue regole di isolamento.
4. **Parser DOT + risoluzione delle card** e validatore di integrità referenziale (doc 1 §2).
5. **Analisi statica**: autonomia (doc 1 §8.1), poi sicurezza (doc 1 §8.2), con output spiegabile (doc 1 §8.3).
6. **Archivio + indice** con hashing del contenuto e versionamento semantico (doc 1 §4, §5).

**Fase 2 — capire il sito**

7. **Landing, gradini 1-3** (claim, ancoraggio, autolocalizzazione). Testo prima, animazione dopo.
8. **Pagina "cosa non è"** e recap delle componenti (§3).
9. **Pagina "quali task"** (§4).

**Fase 3 — l'onboarding pratico**

10. **Starter blueprint statico**: le cinque card + il DOT, senza tutorial. Deve girare da riga di comando su una macchina utente.
11. **Vista sincronizzata a quattro riquadri** (§5.1). Riusata poi ovunque.
12. **Percorso guidato** con le tre scelte e il pannello punteggi live (§5.3, §5.6).
13. **Interruttore dimostrativo** e **loop di debugging** (§5.4, §5.5).

**Fase 4 — il sito vero**

14. **Registrazione al salvataggio**, profilo, toggle pubblico/privato (§6).
15. **Galleria e libreria nodi** con upload e schede di valutazione. Autonomia come filtro, non come classifica (§1.1).
16. **Telemetria opt-in** e badge di completamento (§6.2), con etichetta *riportato* e non *misurato* (doc 1 §8).
17. **Hero animata** (§2.2, §2.3).

**Fase 5 — distribuzione e community**

18. **Server MCP** con semantic search e i quattro punti di ingresso (§7.2).
19. **Voti sulle metriche soggettive**, reputazione, validatori.
20. **Namespace locali e promozione all'ontologia centrale** (doc 1 §7).
21. **Canali di distribuzione** (§9).
22. *(rimandato)* composizione blueprint-dentro-blueprint (doc 1 §1).

> **Due note sull'ordine.** L'hero animata è al punto 17 di proposito: è la parte più visibile e la più facile da anticipare per entusiasmo, ma il problema segnalato dal feedback è di testo e di sequenza, non di grafica. E la fase 0 non è burocrazia: sono i tre punti che, se saltati, costringono a riscrivere il resto.

---

## 12. Questioni aperte

- Strada A (SVG) o strada B (Three.js) per la hero (§2.3)
- Se la fabbrica della hero debba risolversi nei cinque nodi dello starter (§2.2)
- Range e default del cursore delle iterazioni di debug (§5.3)
- Formato esatto delle evidenze di fallimento passate al `debugger` (§5.5)
- Come si guadagna reputazione da validatore (documento 1, §7)
- Soglie di promozione dall'ontologia locale al nucleo (documento 1, §7)
