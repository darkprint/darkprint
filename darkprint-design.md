# DarkPrint — Documento di design

> Stato: design consolidato da una sessione di ragionamento. Alcune scelte sono **decise**, altre sono **raccomandazioni da confermare** (segnalate come tali). Documento pensato come input per l'implementazione.

---

## 0. Cos'è DarkPrint

`darkprint.io` — piattaforma dove sviluppatori e ricercatori caricano, valutano, condividono ed **eseguono** blueprint di *dark factory*: grafi che descrivono pipeline di agenti AI autonomi.

Target primario: sviluppatori e ricercatori tecnici nel mondo degli agenti AI.

Le tre superfici del sito:

| Sezione | Contenuto | Primitiva |
|---|---|---|
| **Gallery** | Blueprint completi (grafi) | grafo |
| **Nodes** (ex "Parts") | Card dei nodi riutilizzabili | nodo |
| **Ontology** | Vocabolario controllato | semantica |

---

## 1. Struttura concettuale: due primitive, non tre

**Decisione:** il sito ha **due primitive strutturali** — il **nodo** (card singola) e il **blueprint** (grafo completo).

La sezione "parts" intesa come *sottografi riutilizzabili* viene **rimandata**, non implementata ora:

- Nodo e blueprint sono primitive nette e non ambigue; il sottografo è una via di mezzo che introduce un terzo livello con confini arbitrari ("quando un pezzo smette di essere un nodo e diventa un sottografo?").
- Un sottografo è, in fondo, **solo un blueprint più piccolo**. Quando il bisogno emergerà (pattern ricorrenti tipo retry o negoziazione tra agenti, che raramente sono un nodo solo), lo si risolve permettendo di **importare un blueprint dentro un altro** — non con una terza sezione.

**Implicazione implementativa:** progettare il modello dati del blueprint in modo che sia già *componibile* (un blueprint può referenziare un altro blueprint come nodo composito), anche se l'UI non lo espone subito.

L'**ontologia** resta invece una sezione a sé: non è una primitiva strutturale, è il **vocabolario** che dà significato alle altre due.

---

## 2. Modello dati: topologia e dettaglio separati

**Decisione centrale.** Il DOT porta **solo la topologia**; il dettaglio ricco vive in **card esterne**.

```
blueprint.dot          →  nodi + archi, identificatori, niente altro
cards/<id>@<ver>.yaml  →  la definizione completa di ogni nodo
```

Ogni nodo nel DOT ha un **identificatore univoco** che fa da puntatore alla card che lo istanzia.

### Perché

- Il grafo resta leggibile e disegnabile con gli strumenti classici del DOT (Graphviz e affini).
- Gli attributi DOT sono **tutte stringhe piatte**: una configurazione annidata andrebbe serializzata a mano e ri-parsata. YAML/JSON no.
- Le card si versionano, riusano e validano **separatamente** dal grafo.
- La stessa card è referenziabile da blueprint diversi **senza duplicazione**.

### Ruolo degli archi

Gli archi rappresentano le **interfacce**: un arco da A a B dice che l'output di A diventa l'input di B. Sull'arco si può annotare il tipo di dato che transita.

### Vincolo da presidiare: integrità referenziale

Serve un validatore che verifichi, a ogni upload:

1. ogni identificatore presente nel DOT ha la sua card;
2. non esistono card orfane nel bundle;
3. i tipi dichiarati negli input/output sono coerenti lungo ogni arco;
4. tutti i valori di campi strutturali esistono nell'ontologia dichiarata (vedi §6).

---

## 3. Anatomia della card nodo

**Formato:** YAML (o JSON). YAML se si vuole che sia leggibile e scrivibile a mano; JSON se prevale il consumo programmatico. Il modello è identico.

Quattro blocchi:

### 3.1 Identità
- `id` — identificatore univoco, **è la chiave che lega la card al nodo nel DOT**
- `name` — nome leggibile
- `type` — tipo di nodo → **riferimento all'ontologia** (agente, strumento, controllo umano, decisione, validazione, …)

### 3.2 Comportamento
- `action` — l'operazione che il nodo esegue
- `model` / `agent` — chi la esegue
- `tools[]` — strumenti richiesti (alimenta anche la scheda tecnica del blueprint)
- `params` — parametri di configurazione (annidati)

### 3.3 Interfacce
- `inputs[]` — input attesi, con tipo/formato
- `outputs[]` — output prodotti, con tipo/formato
- `dependencies[]` — da quali altri nodi riceve dati (rende esplicito il collegamento)

### 3.4 Metadati di valutazione
- `requires_human` — flag per la metrica **autonomia**
- `risk_markers[]` — marcatori per la metrica **sicurezza** → **riferimenti all'ontologia**
- `notes` — note tecniche libere

### 3.5 Campi di servizio
- `version` — versione semantica della card (§4)
- `author` / `provenance` — chi l'ha scritta, da dove viene
- `ontology_version` — contro quale versione del vocabolario è scritta

> **La struttura è a due facce:** identità + comportamento + interfacce servono all'**esecuzione**; i metadati di valutazione servono all'**analisi statica**. Lo stesso file alimenta entrambi i mondi.

Una collezione di queste card è di fatto la **libreria di nodi riutilizzabili** del sito.

---

## 4. Versionamento delle card

**Principio invariante: una card pubblicata non si modifica mai sul posto.** Se cambia, nasce una nuova versione. Motivo: un blueprint che punta a quella card si aspetta un comportamento preciso; cambiarlo sotto i piedi invalida le valutazioni già raccolte.

### Versionamento semantico (`MAJOR.MINOR.PATCH`)

| Componente | Quando incrementa |
|---|---|
| **MAJOR** | modifica che rompe la compatibilità (cambio di `inputs`/`outputs`) |
| **MINOR** | aggiunta retrocompatibile (nuovo strumento opzionale) |
| **PATCH** | correzione minore (nota, parametro di default) |

### Come il DOT referenzia la card — **decisione: pinnare la versione esatta**

Due modi possibili:

- `id` + versione esatta → blueprint **congelato e riproducibile al 100%**
- solo `id`, si prende l'ultima compatibile → più comodo, meno prevedibile

**Per DarkPrint si pinna la versione esatta.** Le metriche devono essere ripetibili e confrontabili: quando due utenti votano efficacia o affidabilità, devono aver valutato **esattamente lo stesso nodo**.

### Identificazione per hash del contenuto

**Decisione.** Ogni versione di card è identificata anche da un **hash del suo contenuto**. Conseguenze desiderate:

- l'identificatore stesso **garantisce** che il contenuto non sia cambiato;
- due card identiche **collassano naturalmente sullo stesso hash** (deduplicazione gratuita);
- riproducibilità verificabile: un blueprint riesegue esattamente ciò che ha valutato.

Lo storico delle versioni è **immutabile**: una card vecchia resta sempre recuperabile.

---

## 5. Persistenza: archivio immutabile + indice interrogabile

Le due filosofie si combinano.

### 5.1 Archivio del contenuto (immutabile)
Git, oppure object storage dove ogni versione ha la sua chiave (l'hash di §4).

Perché Git funziona bene: le card sono file di testo → storico completo gratis, diff tra versioni, immutabilità del passato garantita dalla natura stessa dello strumento. E sposa il fatto che i nodi riutilizzabili sono di fatto codice condiviso.

### 5.2 Indice (database)
Serve comunque all'app. Contiene **puntatori** alle versioni archiviate, più tutto ciò che va interrogato in fretta:

- quale card, quale versione, quale autore
- reputazione di autori e validatori
- quali blueprint usano quale card
- tag, categorie, filtri di ricerca
- le sei metriche di valutazione e i voti della community
- telemetria opt-in (costo/tempo di esecuzione)

> Regola pratica: **il contenuto vive nell'archivio versionato, i metadati di ricerca nel database.** Cercare e filtrare su Git puro è scomodo; garantire immutabilità su un DB è un lavoro in più.

---

## 6. Ontologia — il vocabolario controllato

L'ontologia è **il contratto**; le card sono le **istanze** che lo rispettano.

### 6.1 Aggancio alle card

Ogni volta che una card scrive un valore in un **campo strutturale** (`type`, categoria, `risk_markers`), quel valore **non è testo libero**: è un riferimento a una voce dell'ontologia. L'ontologia definisce quali voci esistono, cosa significano, e che **relazioni** hanno tra loro (es. "validazione" è un caso particolare di "controllo").

Tre vantaggi:

1. **Coerenza** — due utenti non chiamano la stessa cosa in due modi diversi; metriche e ricerche funzionano davvero.
2. **Analisi statica più potente** — si può ragionare sui tipi in modo semantico ("questo marcatore è una sottocategoria di accesso esterno").
3. **Evoluzione centralizzata** — il vocabolario cresce senza toccare le singole card.

### 6.2 Evoluzione senza rotture

Stesso problema del versionamento delle card, ma con posta più alta: l'ontologia sta sotto a tutto.

**Principio: aggiungere è sicuro, cambiare o togliere è pericoloso.**

- ✅ **Aggiungere** un tipo o un marcatore → non rompe nulla, le card vecchie semplicemente non lo usano. Libero.
- ⚠️ **Rinominare** (es. "controllo umano" → "intervento umano") → tutte le card che puntavano al vecchio nome diventano orfane.
- ⚠️ **Rimuovere o fondere** voci → stessi riferimenti rotti.

**Soluzione: non si cancella mai davvero.** Un rename è in realtà:

1. si crea la nuova voce;
2. si marca la vecchia come **deprecata** (resta valida per chi la usa);
3. si registra un **puntatore di equivalenza** tra le due;
4. il sito suggerisce la nuova per le card nuove.

L'ontologia stessa è **versionata**. Ogni card e ogni blueprint dichiara contro quale versione è scritto, così l'analisi statica sa sempre come interpretarlo. Le migrazioni sono esplicite e tracciate, mai silenziose.

---

## 7. Governance dell'ontologia — modello a livelli

L'ontologia è un bene comune; chi può modificarla è una scelta di design.

Opzioni valutate: (1) centralizzato — coerenza massima ma collo di bottiglia; (2) proposte con revisione; (3) **a livelli — raccomandato per DarkPrint**.

### Modello a livelli

- **Nucleo centrale** — curato, stabile, cambia di rado e con revisione seria.
- **Namespace locali** — ogni utente può definire tipi e marcatori propri (es. `berti/rischio-memoria-persistente`) senza sporcare il nucleo comune.
- **Promozione** — un'estensione locale che ricorre e si diffonde sale nel nucleo.

Risolve la tensione di fondo: **stabilità del bene comune** da una parte, **libertà di sperimentare** dall'altra. La reputazione è il meccanismo che fa salire le idee buone.

### Il processo di promozione, in quattro fasi

**1. Emersione.** La voce vive nel namespace dell'autore. Il sistema conta: quante card la usano, quanti **autori distinti** l'hanno adottata, in quanti blueprint compare.

**2. Segnalazione (automatica).** Superata una soglia — indicativamente *N autori distinti su M blueprint*, da tarare — la voce viene marcata **"candidata alla promozione"**. Non è ancora una decisione umana: è un segnale che il pattern è reale e non il capriccio di uno.

**3. Revisione.** Entrano i validatori ad alta reputazione. Valutano: è davvero distinta dalle voci esistenti o è un doppione? È definita bene? Come si aggancia al nucleo? Esito possibile anche la **fusione** con una voce esistente invece dell'aggiunta.

**4. Adozione.** La voce entra nel nucleo con la sua versione, e si crea un **puntatore di equivalenza** dal nome locale a quello canonico — le card esistenti non si rompono (stesso meccanismo di §6.2).

> Risultato: l'ontologia cresce **dal basso** ma resta curata. La community propone, i dati d'uso filtrano, i validatori sanciscono.

**Aperto:** tarare le soglie della fase 2 e definire come si guadagna la reputazione da validatore.

---

## 8. Le sei metriche di valutazione

| Metrica | Come si ottiene |
|---|---|
| **Autonomia** (1–4) | analisi statica del grafo |
| **Sicurezza** (1–4) | analisi statica del grafo |
| **Costo di esecuzione** | misurato oggettivamente a runtime (telemetria opt-in) |
| **Tempo di esecuzione** | misurato oggettivamente a runtime (telemetria opt-in) |
| **Efficacia** | voto della community |
| **Affidabilità** | voto della community |
| **Trasparenza** | voto della community |

### 8.1 Autonomia — regola a frazione

Deterministica, ripetibile, spiegabile.

```
1. Parsing del DOT → grafo in memoria (NetworkX o equivalente)
2. Per ogni nodo, risolvere la card e leggere `requires_human`
   (o il type ontologico "controllo umano" / "input manuale")
3. frazione_autonomi = nodi_senza_intervento / nodi_totali
4. Mappare la frazione su scala 1–4 a soglie
```

Esempio di mappatura (da tarare):

| Frazione | Punteggio |
|---|---|
| > 0.90 | 4 |
| 0.70 – 0.90 | 3 |
| 0.50 – 0.70 | 2 |
| < 0.50 | 1 |

*Esempio: 10 nodi, 2 richiedono intervento umano → 0.8 → punteggio 3.*

### 8.2 Sicurezza — regola a penalità pesate

Il ragionamento si **ribalta**: si parte da 4 e si sottrae. E **non conta la frazione, conta la gravità**: un solo nodo che esegue codice arbitrario può far crollare il punteggio anche se il resto del grafo è pulito.

Pattern da cercare (ciascuno con un **peso**):

1. **Esecuzione di codice arbitrario** (shell, `eval`) — peso alto
2. **Accesso a risorse esterne / rete** senza un nodo di validazione o filtro a monte
3. **Cicli senza condizione d'uscita chiara** — rischio di non terminazione
4. **Scrittura su disco o database** senza passaggio di controllo a monte

```
punteggio = 4 − Σ(penalità dei pattern trovati)  →  clamp su scala 1–4
```

**Aperto:** definire i pesi relativi dei quattro rischi.

### 8.3 Requisito trasversale: spiegabilità

Per entrambe le metriche statiche, il sistema deve **mostrare all'utente esattamente quali nodi** hanno determinato il punteggio (quali hanno abbassato l'autonomia, quali hanno fatto scattare l'allarme sicurezza). La valutazione non è un numero opaco.

Entrambe si ricavano **puramente dalla struttura del grafo, senza eseguirlo**.

---

## 9. Architettura di deployment

### 9.1 Front-end — Vercel (o Netlify)

Ci va tutto ciò che è leggero e interattivo:

- pagine, gallery dei blueprint, libreria dei nodi, sezione ontologia
- autenticazione (username/password) e profilo utente
- upload dei file
- visualizzazione delle schede di valutazione a sei metriche

**Flusso di sviluppo:** repository GitHub → collegato una volta sola a Vercel → ogni PR aperta (anche da Claude Code sul web) genera automaticamente un **deploy di anteprima** con link dedicato, ispezionabile da browser o telefono senza scaricare nulla in locale. Merge → produzione.

> Variabili d'ambiente e chiavi API si configurano nel pannello Vercel, **non** dentro la sandbox di Claude Code.

### 9.2 Backend — servizio separato (Railway, Render, o container)

Le funzioni serverless hanno limiti di tempo e memoria: il lavoro pesante non ci sta. Va su un servizio con processi a lunga durata:

- **analisi statica del grafo** (parsing DOT, calcolo autonomia e sicurezza)
- **esecuzione dei blueprint** + raccolta telemetria opt-in (costo, tempo)
- **database** (indice di §5.2: blueprint, card, tag, autori, reputazione, voti)

### 9.3 Storage

Bucket separato per i file veri e propri (DOT, card, allegati), coerente con l'archivio immutabile di §5.1.

Il front-end parla con tutto questo **via API**.

---

## 10. Ordine di implementazione suggerito

1. **Schema della card nodo** (§3) + validatore YAML/JSON — è il contratto che regge tutto il resto
2. **Parser DOT + risoluzione delle card** e validatore di integrità referenziale (§2)
3. **Ontologia minima** — nucleo di tipi di nodo e marcatori di rischio (§6.1), abbastanza per far girare le metriche
4. **Analisi statica**: autonomia (§8.1), poi sicurezza (§8.2), con output spiegabile (§8.3)
5. **Archivio + indice** con hashing del contenuto e versionamento semantico (§4, §5)
6. **Front-end**: upload, gallery, libreria nodi, schede di valutazione
7. **Community**: voti sulle tre metriche soggettive, reputazione, validatori
8. **Esecuzione dei blueprint** + telemetria opt-in
9. **Namespace locali e promozione all'ontologia centrale** (§7)
10. *(rimandato)* composizione blueprint-dentro-blueprint (§1)

---

## 11. Questioni ancora aperte

- Taratura delle **soglie di autonomia** (§8.1) e dei **pesi di rischio** (§8.2)
- Soglie che fanno scattare la **candidatura alla promozione** (§7, fase 2)
- Come si **guadagna reputazione** da validatore
- YAML vs JSON per le card — dipende da quanto si vuole la scrittura a mano
- Modello di **monetizzazione**: freemium, commissione su blueprint premium, sponsorizzazioni
- Layer di **traduzione via Claude Code** per utenti non tecnici (far girare blueprint senza vederne i dettagli interni)
