const initArrays = () => {
    cfg.size = 17 + 4 * cfg.ver;
    els.canvas.width = els.canvas.height = cfg.size * cfg.cell;
    grid = Array(cfg.size).fill().map(() => 
        Array(cfg.size).fill().map(() => ({ isBlack: false, isStatic: false }))
    );
    reserved = Array(cfg.size).fill().map(() => Array(cfg.size).fill(false));
};

const setModule = (x, y, black, static) => {
    if (x >= 0 && x < cfg.size && y >= 0 && y < cfg.size) {
        grid[y][x] = { isBlack: black, isStatic: static };
        static && (reserved[y][x] = true);
    }
};

const patterns = {
    finder: (x, y) => {
        for (let dy = -1; dy <= 7; dy++)
            for (let dx = -1; dx <= 7; dx++) {
                const inBounds = dx >= 0 && dx <= 6 && dy >= 0 && dy <= 6;
                const isBlack = inBounds && (dx === 0 || dx === 6 || dy === 0 || dy === 6 || (dx >= 2 && dx <= 4 && dy >= 2 && dy <= 4));
                setModule(x + dx, y + dy, isBlack, true);
            }
    },
    timing: () => {
        for (let i = 8; i < cfg.size - 8; i++) {
            const isBlack = i % 2 === 0;
            if (!reserved[6][i]) setModule(i, 6, isBlack, true);
            if (!reserved[i][6]) setModule(6, i, isBlack, true);
        }
    },
    alignment: (x, y) => {
        const isValid = ![{ x1: -1, y1: -1, x2: 7, y2: 7 }, { x1: cfg.size - 8, y1: -1, x2: cfg.size, y2: 7 }, { x1: -1, y1: cfg.size - 8, x2: 7, y2: cfg.size }]
            .some(f => x <= f.x2 && x + 4 >= f.x1 && y <= f.y2 && y + 4 >= f.y1);
        if (!isValid) return;
        for (let dy = 0; dy < 5; dy++)
            for (let dx = 0; dx < 5; dx++)
                setModule(x + dx, y + dy, dx === 0 || dx === 4 || dy === 0 || dy === 4 || (dx === 2 && dy === 2), true);
    },
    format: () => {
        let formatString = els.formatInfo.value || '111011111000100', bits = formatString.split('').reverse().map(Number), i = 0;
        for (let col = 0; col <= 5; col++) setModule(8, col, bits[i++] === 1, true);
        setModule(8, 7, bits[i++] === 1, true); setModule(8, 8, bits[i++] === 1, true); setModule(7, 8, bits[i++] === 1, true);
        for (let col = 5; col >= 0; col--) setModule(col, 8, bits[i++] === 1, true);
        i = 0;
        for (let col = cfg.size - 1; col >= cfg.size - 8; col--) setModule(col, 8, bits[i++] === 1, true);
        for (let row = cfg.size - 7; row < cfg.size; row++) setModule(8, row, bits[i++] === 1, true);
        setModule(8, cfg.size - 8, true, true);
    },
    version: () => {
        if (cfg.ver < 7) return;
        const versionString = els.versionInfo.value || '000111110010010100', bits = versionString.split('').map(Number);
        for (let i = 0; i < 6; i++)
            for (let j = 0; j < 3; j++) {
                const idx = i * 3 + j;
                setModule(i, cfg.size - 11 + j, bits[idx] === 1, true);
                setModule(cfg.size - 11 + j, i, bits[idx] === 1, true);
            }
    }
};

let lastSize = 0;
const initGrid = () => {
    cfg.ver = +els.version.value;
    cfg.errLevel = els.errCorr.value;
    cfg.size = 17 + 4 * cfg.ver;
    if (cfg.size === lastSize) return;
    lastSize = cfg.size;
    initArrays();
    patterns.finder(0, 0); patterns.finder(cfg.size - 7, 0); patterns.finder(0, cfg.size - 7);
    patterns.timing();
    if (cfg.ver >= 2)
        getAlignPos(cfg.ver).forEach(y => getAlignPos(cfg.ver).forEach(x => (x !== 6 || (y !== 6 && y !== cfg.size - 7 && x !== cfg.size - 7)) && patterns.alignment(x - 2, y - 2)));
    setModule(8, 4 * cfg.ver + 9, true, true);
    patterns.format();
    patterns.version();
    drawGrid();
    interpretData();
    updateFormatInfoDisplay();
};

const updateFormatInfo = () => {
    const eccLevel = els.errCorr.value, mask = els.maskPattern.value, formatInfo = formatInformationStrings[eccLevel + mask];
    els.formatInfo.value = formatInfo;
    patterns.format();
    updateFormatInfoDisplay();
    drawGrid();
};

const drawGrid = () => {
    ctx.clearRect(0, 0, els.canvas.width, els.canvas.height);
    grid.forEach((row, y) =>
        row.forEach((cell, x) => {
            ctx.fillStyle = cell.isBlack ? '#000' : '#fff';
            ctx.fillRect(x * cfg.cell, y * cfg.cell, cfg.cell, cfg.cell);
            ctx.strokeStyle = '#ddd';
            ctx.strokeRect(x * cfg.cell, y * cfg.cell, cfg.cell, cfg.cell);
            if (cell.isStatic) {
                ctx.fillStyle = 'rgba(0,123,255,0.2)';
                ctx.fillRect(x * cfg.cell, y * cfg.cell, cfg.cell, cfg.cell);
            }
        })
    );
    if (cfg.showReadOrder) drawReadOrder();
    if (cfg.showDimensions) drawDimensions();
};

const showNotification = message => {
    const notification = els.notification;
    notification.textContent = message;
    notification.classList.remove('hide');
    notification.classList.add('show');
    setTimeout(() => {
        notification.classList.remove('show');
        notification.classList.add('hide');
    }, 3000);
};

const checkFormatInfoValid = () => Object.values(formatInformationStrings).includes(els.formatInfo.value);
const checkVersionInfoCorrect = () => cfg.ver < 7 || versionInformationStrings[cfg.ver] === els.versionInfo.value;


function getDataBitsInReadingOrder() {
    const dataBits = [];
    // Start from bottom-right
    let x = cfg.size - 1;
    let y = cfg.size - 1;
    let goingUp = true; // first “leg” goes upward

    while (true) {
        // For each 'leg', handle two adjacent columns: (x) and (x-1)
        for (let i = 0; i < 2; i++) {
            let col = x - i;
            // Skip the timing column
            if (col === 6) {
                col--;
            }
            // If we've gone off the left edge, we’re done
            if (col < 0) break;

            // Collect a bit if this cell is not reserved (function pattern)
            if (!reserved[y][col]) {
                dataBits.push(grid[y][col].isBlack ? '1' : '0');
            }
        }

        // Move our “scan head” up or down by one row
        if (goingUp) {
            y--;
            // If we pass the top, move two columns left, flip direction
            if (y < 0) {
                x -= 2;
                y = 0;
                goingUp = false;
                // If we’ve gone off the left edge, we’re done
                if (x < 0) break;
            }
        } else {
            // Going downward
            y++;
            // If we pass the bottom, move two columns left, flip direction
            if (y >= cfg.size) {
                x -= 2;
                y = cfg.size - 1;
                goingUp = true;
                if (x < 0) break;
            }
        }
    }

    return dataBits.join('');
}



const interpretData = () => {
    // 1. Get all data bits in the correct read order:
    const bits = getDataBitsInReadingOrder();

    // 2. Parse the first 4 bits as the Mode
    const modeBits = bits.slice(0, 4);
    let modeString = '';
    switch (modeBits) {
        case '0001': modeString = 'Numeric'; break;
        case '0010': modeString = 'Alphanumeric'; break;
        case '0100': modeString = 'Byte'; break;
        case '0111': modeString = 'ECI'; break;
        case '1000': modeString = 'Kanji'; break;
        default:     modeString = 'Unknown'; 
    }

    // 3. Parse the next 8 bits as the Length
    const lengthBits = bits.slice(4, 12);
    const lengthDecimal = parseInt(lengthBits, 2);

    // 4. The rest are “data” bits (for ASCII, hex, etc.)
    const dataBits = bits.slice(12);

    // Convert dataBits -> ASCII
    const ascii = dataBits.match(/.{8}/g)?.map(byte => 
        String.fromCharCode(parseInt(byte, 2))
    ).join('') || '';

    // Convert dataBits -> Hex
    const hex = dataBits.match(/.{8}/g)?.map(byte =>
        parseInt(byte, 2).toString(16).padStart(2, '0')
    ).join(' ') || '';

    // Stats and checks as you had before:
    const darkModuleCount = grid.flat().filter(cell => cell.isBlack).length;
    const darkModulePercentage = (darkModuleCount / (cfg.size * cfg.size)) * 100;
    const timingCorrect = Array(cfg.size - 16).fill().every((_, i) => {
        const idx = i + 8, expected = idx % 2 === 0;
        return grid[6][idx].isBlack === expected && grid[idx][6].isBlack === expected;
    });

    // 5. Update the info panel
    els.info.innerHTML = `
        <p><strong>Encoding Mode:</strong> ${modeString} <em>[${modeBits}]</em></p>
        <p><strong>Data Length (decimal):</strong> ${lengthDecimal} <em>[${lengthBits}]</em></p>
        <p><strong>Data Length (bits total after Mode+Length):</strong> ${dataBits.length}</p>
        <p><strong>Timing Pattern Correct:</strong> ${timingCorrect ? 'Yes' : 'No'}</p>
        <p><strong>Format Info Valid:</strong> ${checkFormatInfoValid() ? 'Yes' : 'No'}</p>
        <p><strong>Version Info Correct:</strong> ${checkVersionInfoCorrect() ? 'Yes' : 'No'}</p>
        <p><strong>Dark Module Percentage:</strong> ${darkModulePercentage.toFixed(2)}%</p>
        <p><strong>Dark Module Count:</strong> ${darkModuleCount}</p>
    `;
    
    // 6. Show the extracted bits in the textarea
    els.data.value = 
        `All Bits (in read order):\n${bits}\n\n` +
        `Mode Bits (first 4): ${modeBits} => ${modeString}\n` +
        `Length Bits (next 8): ${lengthBits} => ${lengthDecimal}\n\n` +
        `Payload Bits:\n${dataBits}\n\n` +
        `ASCII Interpretation:\n${ascii}\n\n` +
        `Hex Interpretation:\n${hex}`;
};



const updateFormatInfoDisplay = () => {
    const formatString = els.formatInfo.value || '101010000010010', maskPattern = formatString.substring(2, 5),
        maskPatternExplanation = maskPatterns[maskPattern] || 'Unknown';
    document.getElementById('formatInfoExplanation').innerHTML = `<p><b>Mask Pattern:</b> ${maskPatternExplanation} (${maskPattern})</p>
        <p>Bits 5-14 are error correction bits derived from the first 5 bits.</p>`;
};

const drawReadOrder = () => {
    if (!cfg.showReadOrder) return;

    let currentBit = 0;
    let boxCount = 0;
    let bitsInCurrentBox = []; // Track bit positions for current box
    const boxPositions = []; // Store box positions for arrow drawing

    const drawBoxone = (x, y, width, height, label, color) => {
        const pixelX = x * cfg.cell;
        const pixelY = y * cfg.cell;
        const pixelWidth = width * cfg.cell;
        const pixelHeight = height * cfg.cell;
    
        ctx.fillStyle = color;
        ctx.fillRect(pixelX, pixelY, pixelWidth, pixelHeight);
    
        ctx.strokeStyle = 'rgba(255, 0, 0, 0.5)';
        ctx.strokeRect(pixelX, pixelY, pixelWidth, pixelHeight);
    
        ctx.fillStyle = 'black';
        ctx.font = '12px Arial';
        ctx.textAlign = 'center';
        ctx.textBaseline = 'middle';
        ctx.fillText(label, pixelX + pixelWidth / 2, pixelY + pixelHeight / 2);
    };

    const drawBox = (x, y, boxNum) => {
        ctx.fillStyle = `rgba(0, 0, 255, ${0.1 + (boxNum % 2) * 0.1})`;
        ctx.fillRect(x * cfg.cell, y * cfg.cell, cfg.cell, cfg.cell);

        ctx.strokeStyle = 'black'; // Border color
        ctx.lineWidth = 1;

        // Check neighbors and draw borders only where needed
        const neighbors = [
            { dx: 0, dy: -1 }, // Top
            { dx: 1, dy: 0 },  // Right
            { dx: 0, dy: 1 },  // Bottom
            { dx: -1, dy: 0 } // Left
        ];

        neighbors.forEach(n => {
            const nx = x + n.dx;
            const ny = y + n.dy;
            if (nx >= 0 && nx < cfg.size && ny >= 0 && ny < cfg.size) {
               const neighborIsSameBox = bitsInCurrentBox.some(bit => bit.x === nx && bit.y === ny);

               if (!neighborIsSameBox && !reserved[ny][nx]) { 
                   // Draw the border if it is part of another block or isn't reserved
                    ctx.beginPath();
                    if (n.dx === 0) { // Top or Bottom border
                        ctx.moveTo(x * cfg.cell , (y + n.dy/2 + 0.5) * cfg.cell);
                        ctx.lineTo((x + 1) * cfg.cell, (y+ n.dy/2 + 0.5) * cfg.cell);
                    } else { // Left or Right border
                        ctx.moveTo((x + n.dx/2 + 0.5)* cfg.cell, y * cfg.cell);
                        ctx.lineTo((x + n.dx/2 + 0.5) * cfg.cell, (y + 1) * cfg.cell);
                    }
                    ctx.stroke();
                } else if (reserved[ny][nx]){
                   ctx.strokeStyle = 'red'; // Border color
                   ctx.lineWidth = 1;
                   ctx.beginPath();
                    if (n.dx === 0) { // Top or Bottom border
                        ctx.moveTo(x * cfg.cell , (y + n.dy/2 + 0.5) * cfg.cell);
                        ctx.lineTo((x + 1) * cfg.cell, (y+ n.dy/2 + 0.5) * cfg.cell);
                    } else { // Left or Right border
                        ctx.moveTo((x + n.dx/2 + 0.5)* cfg.cell, y * cfg.cell);
                        ctx.lineTo((x + n.dx/2 + 0.5) * cfg.cell, (y + 1) * cfg.cell);
                    }
                    ctx.stroke();                       
               }

            }
        });


    };

    const isValidDataPosition = (x, y) => {
        if (x < 0 || y < 0 || x >= cfg.size || y >= cfg.size) return false;
        return !reserved[y][x];
    };

    const drawDataBoxes = () => {
        let x = cfg.size - 1;
        let y = cfg.size - 1;
        let up = true;
        currentBit = 0;
        y -= 6; // Adjust this value if needed based on indicator sizes
        while (x >= 0 && y >= 0) {
            for (let i = 0; i < 2; i++) { // Two columns at a time
                if (isValidDataPosition(x - i, y)) {
                    currentBit++;
                    bitsInCurrentBox.push({ x: x - i, y });

                    if (bitsInCurrentBox.length === 8) {
                        boxCount++;
                        let boxCenterX = 0;
                        let boxCenterY = 0;
                        for (let j = 0; j < bitsInCurrentBox.length; j++) {
                            drawBox(bitsInCurrentBox[j].x, bitsInCurrentBox[j].y, boxCount);
                            ctx.fillStyle = 'black';
                            ctx.font = '10px Arial';
                            ctx.textAlign = 'center';
                            ctx.textBaseline = 'middle';
                            ctx.fillText(j + 1, bitsInCurrentBox[j].x * cfg.cell + cfg.cell / 2, bitsInCurrentBox[j].y * cfg.cell + cfg.cell / 2);
                            boxCenterX += bitsInCurrentBox[j].x;
                            boxCenterY += bitsInCurrentBox[j].y;
                        }
                        boxPositions.push({ x: boxCenterX / 8, y: boxCenterY / 8}); // Store center
                        bitsInCurrentBox = [];
              }
          }
        }

        if (up) {
            y -= 1;
            if (y < 0 ) { 
              x -= 2;
              y = 0;
              up = false;
              continue; // Don't reverse direction yet
            }

        } else {
            y += 1;
            if (y >= cfg.size) {
              x -= 2;
              y = cfg.size -1;
              up = true;
              continue; // Don't reverse direction
            }
          }

          
         if (x < 0) break; // boundary
         if (x === 6) x--; // timing

      }
    };

    const drawArrow = (from, to) => {
        const fromX = from.x * cfg.cell + cfg.cell / 2;
        const fromY = from.y * cfg.cell + cfg.cell / 2;
        const toX = to.x * cfg.cell + cfg.cell / 2;
        const toY = to.y * cfg.cell + cfg.cell / 2;

        ctx.strokeStyle = 'green';
        ctx.lineWidth = 2;
        ctx.beginPath();
        ctx.moveTo(fromX, fromY);
        ctx.lineTo(toX, toY);
        ctx.stroke();

        // Arrowhead (basic triangle)
        const headlen = 10; // length of head in pixels
        const dx = toX - fromX;
        const dy = toY - fromY;
        const angle = Math.atan2(dy, dx);
        ctx.beginPath();
        ctx.moveTo(toX, toY);
        ctx.lineTo(toX - headlen * Math.cos(angle - Math.PI / 6), toY - headlen * Math.sin(angle - Math.PI / 6));
        ctx.lineTo(toX - headlen * Math.cos(angle + Math.PI / 6), toY - headlen * Math.sin(angle + Math.PI / 6));
        ctx.closePath();
        ctx.fill();
    };

    drawBoxone(cfg.size - 2, cfg.size - 2, 2, 2, "Mode", 'rgba(255, 0, 0, 0.2)');

    // Length (2x4 box above mode)
    drawBoxone(cfg.size - 2, cfg.size - 6, 2, 4, "Length", 'rgba(0, 255, 0, 0.2)');

    drawDataBoxes();

    for (let i = 0; i < boxPositions.length - 1; i++) {
        drawArrow(boxPositions[i], boxPositions[i + 1]);
    }
};


const drawDimensions = () => {
    if (!cfg.showDimensions) return;

    ctx.font = `${cfg.cell / 1.25}px Arial`; // Adjust font size based on cell size
    ctx.fillStyle = 'blue';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';

    // Draw row numbers along the left side inside the padding
    for (let y = 0; y < cfg.size; y++) {
        ctx.fillText(y, cfg.cell / 2, y * cfg.cell + cfg.cell / 2);
    }

    // Draw column numbers along the top inside the padding
    for (let x = 0; x < cfg.size; x++) {
        ctx.fillText(x, x * cfg.cell + cfg.cell / 2, cfg.cell / 2);
    }
};
els.canvas.addEventListener('click', e => {
    const rect = els.canvas.getBoundingClientRect(), x = Math.floor((e.clientX - rect.left) * (els.canvas.width / rect.width) / cfg.cell),
        y = Math.floor((e.clientY - rect.top) * (els.canvas.height / rect.height) / cfg.cell);
    if (x >= 0 && x < cfg.size && y >= 0 && y < cfg.size) {
        const cell = grid[y][x];
        if (cell.isStatic && !els.static.checked) {
            showNotification('This is a static element. Enable static editing to modify.');
            return;
        }
        cell.isBlack = !cell.isBlack;
        drawGrid();
        interpretData();
    }
});

els.genBtn.addEventListener('click', initGrid);
els.static.addEventListener('change', () => cfg.editStatic = els.static.checked);
els.formatInfo.addEventListener('input', () => { patterns.format(); updateFormatInfoDisplay(); drawGrid(); });
els.versionInfo.addEventListener('input', () => { patterns.version(); drawGrid(); });
els.errCorr.addEventListener('change', updateFormatInfo);
els.maskPattern.addEventListener('change', updateFormatInfo);
els.readOrderBtn.addEventListener('click', () => {
    cfg.showReadOrder = !cfg.showReadOrder;
    els.readOrderBtn.textContent = cfg.showReadOrder ? 'Hide Read Order' : 'Show Read Order';
    drawGrid();
});
els.dimensionsBtn.addEventListener('click', () => {
    cfg.showDimensions = !cfg.showDimensions;
    els.dimensionsBtn.textContent = cfg.showDimensions ? 'Hide Dimensions' : 'Show Dimensions';
    drawGrid();
});
initGrid();
