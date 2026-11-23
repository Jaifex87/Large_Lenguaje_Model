        const documentPath = "./LLMFINETUNNING.txt";
        const writing = document.querySelector("#writing");
        const editor = document.querySelector(".writing-editor");
        const mirror = document.querySelector("#writing-mirror");
        const ghost = document.querySelector("#ghost-suggestion");
        const status = document.querySelector("#status");
        let documentLines = [];
        let currentSuggestion = null;
        let suggestionMatches = [];
        let suggestionIndex = 0;
        let suggestionSearch = "";

        function normalizeLine(line) {
            return line.trimStart().replace(/\s+/gu, " ").toLocaleLowerCase();
        }

        function buildModel(text) {
            documentLines = (text.match(/[^;]*;|[^;]+$/gu) || [])
                .map(chunk => chunk.trim())
                .map(chunk => chunk
                    .split(/\r?\n/u)
                    .filter(line => line.trim() && !line.trimStart().startsWith("--"))
                    .join("\n")
                    .trim())
                .filter(statement => /^(SELECT|INSERT|UPDATE|DELETE|CREATE)\b/i.test(statement));
            status.textContent = documentLines.length
                ? `Documento listo: ${documentLines.length} instrucciones SQL disponibles para autocompletar.`
                : "El documento no contiene instrucciones SQL para autocompletar.";
            status.dataset.error = String(documentLines.length === 0);
            updateSuggestions();
        }

function positionGhost(beforeCursor, suffix) {
    const styles = getComputedStyle(writing);
    const padTop = parseFloat(styles.paddingTop) || 0;
    const padRight = parseFloat(styles.paddingRight) || 0;
    const padBottom = parseFloat(styles.paddingBottom) || 0;
    const padLeft = parseFloat(styles.paddingLeft) || 0;

    mirror.style.width = `${writing.offsetWidth}px`;
    mirror.style.height = `${writing.offsetHeight}px`;
    mirror.style.font = styles.font;
    mirror.style.lineHeight = styles.lineHeight;
    mirror.style.letterSpacing = styles.letterSpacing;
    mirror.style.wordSpacing = styles.wordSpacing;
    mirror.style.textIndent = styles.textIndent;
    mirror.style.textTransform = styles.textTransform;
    mirror.style.whiteSpace = "pre-wrap";
    mirror.style.overflowWrap = "break-word";
    mirror.style.wordBreak = styles.wordBreak;
    mirror.style.boxSizing = styles.boxSizing;
    mirror.style.padding = styles.padding;
    mirror.style.border = styles.border;
    mirror.scrollTop = writing.scrollTop;
    mirror.scrollLeft = writing.scrollLeft;

    mirror.replaceChildren(document.createTextNode(beforeCursor));

    const marker = document.createElement("span");
    marker.textContent = "\u200b";
    mirror.append(marker);

    const markerRect = marker.getBoundingClientRect();
    const editorRect = editor.getBoundingClientRect();
    const writingRect = writing.getBoundingClientRect();

    // Coordenadas del cursor respecto a .writing-editor
    const left = markerRect.left - editorRect.left;
    const top = markerRect.top - editorRect.top;

    // Límites interiores del textarea
    const innerLeft = (writingRect.left - editorRect.left) + padLeft;
    const innerRight = (writingRect.right - editorRect.left) - padRight;
    const innerTop = (writingRect.top - editorRect.top) + padTop;
    const innerBottom = (writingRect.bottom - editorRect.top) - padBottom;

    // Ancho máximo disponible en la línea actual sin salirse a la derecha
    const availableWidth = Math.max(0, innerRight - left);

    ghost.style.left = `${left}px`;
    ghost.style.top = `${top}px`;
    ghost.style.width = `${availableWidth}px`;
    ghost.style.maxWidth = `${availableWidth}px`;
    ghost.style.font = styles.font;
    ghost.style.lineHeight = styles.lineHeight;
    ghost.style.letterSpacing = styles.letterSpacing;
    ghost.style.wordSpacing = styles.wordSpacing;
    ghost.textContent = availableWidth > 0 ? suffix : "";

    // Medimos cuánto ocupa realmente el texto fantasma para recortar lo que pase del borde inferior
    const ghostRect = ghost.getBoundingClientRect();
    const clipTop = Math.max(0, innerTop - (ghostRect.top - editorRect.top));
    const clipBottom = Math.max(0, (ghostRect.bottom - editorRect.top) - innerBottom);
    const clipLeft = Math.max(0, innerLeft - (ghostRect.left - editorRect.left));
    const clipRight = Math.max(0, (ghostRect.right - editorRect.left) - innerRight);

    ghost.style.clipPath = `inset(${clipTop}px ${clipRight}px ${clipBottom}px ${clipLeft}px)`;
}

function updateSuggestions() {
    const cursor = writing.selectionStart;
    const beforeCursor = writing.value.slice(0, cursor);
    const newlineStart = beforeCursor.lastIndexOf("\n");
    const semicolonStart = beforeCursor.lastIndexOf(";");
    const statementStart = Math.max(newlineStart, semicolonStart) + 1;
    const statementEndInLine = writing.value.indexOf("\n", statementStart);
    const statementEnd = statementEndInLine === -1 ? writing.value.length : statementEndInLine;
    const currentStatement = beforeCursor.slice(statementStart).trimStart();
    const typedStatement = normalizeLine(currentStatement);

    if (cursor !== statementEnd || writing.selectionStart !== writing.selectionEnd || !typedStatement) {
        suggestionMatches = [];
        suggestionIndex = 0;
        suggestionSearch = "";
        currentSuggestion = null;
    } else {
        if (typedStatement !== suggestionSearch) {
            suggestionSearch = typedStatement;
            suggestionMatches = documentLines.filter(line => {
                const candidate = normalizeLine(line);
                return candidate.startsWith(typedStatement) && candidate !== typedStatement;
            });
            suggestionIndex = 0;
        }

        currentSuggestion = suggestionMatches[suggestionIndex] || null;
    }

    if (currentSuggestion) {
        const suggestionText = currentSuggestion.trimStart();
        const rawTyped = currentStatement.trimStart();
        const suffix = suggestionText.toLocaleLowerCase().startsWith(rawTyped.toLocaleLowerCase())
            ? suggestionText.slice(rawTyped.length)
            : suggestionText.slice(0);

        status.textContent = `Coincidencia ${suggestionIndex + 1} de ${suggestionMatches.length}. Usa \u2191/\u2193 para cambiar y Tab/Enter para aceptar.`;
        status.dataset.error = "false";
        positionGhost(beforeCursor, suffix);
    } else {
        ghost.textContent = "";
        if (typedStatement) {
            status.textContent = "No hay instrucciones que coincidan con lo escrito.";
            status.dataset.error = "true";
        } else {
            status.textContent = `Documento listo: ${documentLines.length} instrucciones SQL disponibles para autocompletar.`;
            status.dataset.error = "false";
        }
    }
}
        function insertSuggestion() {
            if (!currentSuggestion) {
                return;
            }
            const cursor = writing.selectionStart;
            const beforeCursor = writing.value.slice(0, cursor);
            const newlineStart = beforeCursor.lastIndexOf("\n");
            const semicolonStart = beforeCursor.lastIndexOf(";");
            const lineStart = Math.max(newlineStart, semicolonStart) + 1;
            const lineEnd = writing.value.indexOf("\n", lineStart);
            const end = lineEnd === -1 ? writing.value.length : lineEnd;

            writing.value = writing.value.slice(0, lineStart) + currentSuggestion + writing.value.slice(end);
            const nextCursor = lineStart + currentSuggestion.length;
            writing.setSelectionRange(nextCursor, nextCursor);
            writing.focus();
            updateSuggestions();
        }

        async function loadDocument() {
            try {
                const response = await fetch(documentPath);
                if (!response.ok) {
                    throw new Error(`Error HTTP ${response.status}`);
                }
                buildModel(await response.text());
            } catch (error) {
                status.textContent = `No se pudo cargar ${documentPath}: ${error.message}. Abre esta página desde un servidor local.`;
                status.dataset.error = "true";
            }
        }

        writing.addEventListener("input", updateSuggestions);
        writing.addEventListener("click", updateSuggestions);
        writing.addEventListener("keyup", event => {
            if (!["Tab", "Enter", "Escape"].includes(event.key)) {
                updateSuggestions();
            }
        });
        writing.addEventListener("scroll", updateSuggestions);
        writing.addEventListener("keydown", event => {
            if (suggestionMatches.length > 0 && (event.key === "ArrowDown" || event.key === "ArrowUp")) {
                event.preventDefault();
                const direction = event.key === "ArrowDown" ? 1 : -1;
                suggestionIndex = (suggestionIndex + direction + suggestionMatches.length) % suggestionMatches.length;
                updateSuggestions();
            } else if (currentSuggestion && (event.key === "Tab" || event.key === "Enter")) {
                event.preventDefault();
                insertSuggestion();
            } else if (event.key === "Escape") {
                currentSuggestion = null;
                ghost.textContent = "";
            }
        });

        new ResizeObserver(updateSuggestions).observe(writing);
        loadDocument();