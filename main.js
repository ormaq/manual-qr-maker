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
    // Reset lastSize if version actually changes grid size
    if (17 + 4 * cfg.ver !== lastSize) {
         lastSize = 17 + 4 * cfg.ver;
    } else if (cfg.ver === 1 && lastSize === 0) { // Handle initial load case
         lastSize = 21;
    } else {
        // If only ECC/Mask changed, don't re-initialize grid/reserved fully,
        // just update format/version info and redraw.
        // However, for simplicity now, we *will* re-init. If performance becomes an issue, optimize this.
         lastSize = cfg.size; // Update size anyway
    }

    initArrays(); // Initialize grid and reserved arrays
    patterns.finder(0, 0); patterns.finder(cfg.size - 7, 0); patterns.finder(0, cfg.size - 7);
    patterns.timing();
    if (cfg.ver >= 2)
        getAlignPos(cfg.ver).forEach(y => getAlignPos(cfg.ver).forEach(x => (x !== 6 || (y !== 6 && y !== cfg.size - 7 && x !== cfg.size - 7)) && patterns.alignment(x - 2, y - 2)));
    setModule(8, 4 * cfg.ver + 9, true, true); // Dark module
    updateFormatInfo(); // Call this *before* patterns.format() to ensure els.formatInfo has the value
    patterns.format();  // Apply format info based on current selection/input
    patterns.version(); // Apply version info if needed
    drawGrid();
    interpretData();    // Interpret the initial grid state
    updateFormatInfoDisplay(); // Update the explanation display
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

const countAvailableDataCells = () => {
    let count = 0;
    for (let y = 0; y < cfg.size; y++) {
        for (let x = 0; x < cfg.size; x++) {
            if (!reserved[y][x]) {
                count++;
            }
        }
    }
    return count;
};

function getDataBitsInReadingOrder() {
    const dataBits = [];
    let x = cfg.size - 1;
    let y = cfg.size - 1;
    let goingUp = true;

    while (x >= 0) { // Main loop condition based on x column index
        // Process the two columns (right one first)
        for (let i = 0; i < 2; i++) {
            let currentX = x - i;

            // Skip vertical timing pattern column
            if (currentX === 6) continue;

            // Check if column is valid before processing rows
            if (currentX < 0) continue;

            const scanYStart = goingUp ? cfg.size - 1 : 0;
            const scanYEnd = goingUp ? -1 : cfg.size;
            const stepY = goingUp ? -1 : 1;

            for (let currentY = scanYStart; currentY !== scanYEnd; currentY += stepY) {
                // Check if the module is reserved
                if (!reserved[currentY][currentX]) {
                    dataBits.push(grid[currentY][currentX].isBlack ? '1' : '0');
                }
            }
        }

        // Move to the next pair of columns
        x -= 2;

        // Switch direction
        goingUp = !goingUp;
    }
    return dataBits.join('');
}

const writeBitsToGrid = (bits) => {
    let bitIndex = 0;
    let x = cfg.size - 1;
    let y = cfg.size - 1;
    let goingUp = true;

    // Clear existing data bits first (optional, but good for clarity)
    for (let cy = 0; cy < cfg.size; cy++) {
        for (let cx = 0; cx < cfg.size; cx++) {
            if (!reserved[cy][cx]) {
                grid[cy][cx].isBlack = false; // Set non-reserved to white initially
            }
        }
    }

    // Now write the new bits
    x = cfg.size - 1; // Reset x for writing
    while (x >= 0) {
        for (let i = 0; i < 2; i++) {
            let currentX = x - i;

            if (currentX === 6) continue; // Skip timing column
            if (currentX < 0) continue;

            const scanYStart = goingUp ? cfg.size - 1 : 0;
            const scanYEnd = goingUp ? -1 : cfg.size;
            const stepY = goingUp ? -1 : 1;

            for (let currentY = scanYStart; currentY !== scanYEnd; currentY += stepY) {
                if (!reserved[currentY][currentX]) {
                    if (bitIndex < bits.length) {
                        const isBlack = bits[bitIndex] === '1';
                        // Use setModule carefully if needed, but direct grid access is fine here
                        // as we are *only* touching non-reserved cells.
                        grid[currentY][currentX].isBlack = isBlack;
                        bitIndex++;
                    } else {
                        // If we run out of bits, leave remaining data cells as white (already cleared)
                        // grid[currentY][currentX].isBlack = false; // Explicitly set to white
                    }
                }
            }
        }
        x -= 2;
        goingUp = !goingUp;
    }

    if (bitIndex < bits.length) {
        console.warn(`Provided ${bits.length} bits, but only ${bitIndex} could be placed.`);
        showNotification(`Warning: Too many bits provided. Only ${bitIndex} were placed.`);
    }
};

const interpretData = () => {
    const bits = getDataBitsInReadingOrder();
    const maxDataBits = countAvailableDataCells(); // Get max capacity

    // Basic parsing (can be made more robust)
    let modeBits = bits.substring(0, 4);
    let modeString = 'Unknown';
    let lengthBits = '';
    let lengthDecimal = 0;
    let dataBits = '';
    let ascii = '';
    let hex = '';

    if (bits.length >= 4) {
        switch (modeBits) {
            case '0001': modeString = 'Numeric'; break;
            case '0010': modeString = 'Alphanumeric'; break;
            case '0100': modeString = 'Byte'; break;
            case '0111': modeString = 'ECI'; break; // Note: ECI handling is complex
            case '1000': modeString = 'Kanji'; break; // Note: Kanji handling is complex
            // Add other modes if necessary (FNC1 etc.)
            default: modeString = `Invalid/Unknown (${modeBits})`;
        }
    } else {
         modeString = 'Not enough bits for mode';
    }

    // WARNING: Length indicator size VARIES GREATLY by mode and version!
    // This simple 8-bit assumption is ONLY correct for Byte mode in versions 1-9.
    // A full implementation needs QR code capacity tables.
    // For this *manual* tool, we'll just show the next 8 bits as *potential* length.
    if (bits.length >= 12) {
        lengthBits = bits.substring(4, 12);
        lengthDecimal = parseInt(lengthBits, 2);
        dataBits = bits.substring(12);

        // Try to interpret dataBits as ASCII/Hex (best effort)
        try {
            ascii = dataBits.match(/.{1,8}/g)?.map(byte => {
                // Pad if less than 8 bits for the last byte
                const paddedByte = byte.padEnd(8, '0');
                 // Only convert valid ASCII range (e.g., 32-126 printable) or show placeholder
                 const charCode = parseInt(paddedByte, 2);
                 return (charCode >= 32 && charCode <= 126) ? String.fromCharCode(charCode) : `·`; // Use middot for non-printable
            }).join('') || '';

            hex = dataBits.match(/.{1,8}/g)?.map(byte => {
                 const paddedByte = byte.padEnd(8, '0');
                 return parseInt(paddedByte, 2).toString(16).toUpperCase().padStart(2, '0');
            }).join(' ') || '';
        } catch (e) {
            console.error("Error interpreting data bits:", e);
            ascii = "[Error interpreting data]";
            hex = "[Error interpreting data]";
        }

    } else if (bits.length >= 4) {
        lengthBits = bits.substring(4);
        lengthDecimal = NaN; // Not enough bits for full length
        dataBits = '';
        ascii = '';
        hex = '';
    }


    const darkModuleCount = grid.flat().filter(cell => cell.isBlack).length;
    const darkModulePercentage = (darkModuleCount / (cfg.size * cfg.size)) * 100;
    const timingCorrect = Array(cfg.size - 16).fill().every((_, i) => {
        const idx = i + 8;
        // Check bounds before accessing grid - crucial for small versions
        if (idx < 0 || idx >= cfg.size) return true; // Should not happen with loop bounds, but safe
        const expected = idx % 2 === 0;
        // Check if timing pattern cells exist before accessing
        const rowTimingOk = grid[6] && grid[6][idx] ? grid[6][idx].isBlack === expected : false;
        const colTimingOk = grid[idx] && grid[idx][6] ? grid[idx][6].isBlack === expected : false;
        // For timing pattern to be correct, both horizontal and vertical must be correct IF they exist
        return grid[6] && grid[idx] ? (rowTimingOk && colTimingOk) : false; // Simplified: if either row/col index is invalid, pattern is incorrect
    });

    els.info.innerHTML = `
        <p><strong>Grid Size:</strong> ${cfg.size}x${cfg.size}</p>
        <p><strong>Data Capacity (bits):</strong> ${maxDataBits}</p>
        <p><strong>Current Data Bits:</strong> ${bits.length}</p>
        <hr>
        <p><strong>Encoding Mode (Guess):</strong> ${modeString} <em>[${modeBits}]</em></p>
        <p><strong>Length Indicator (Guess):</strong> ${lengthDecimal} <em>[${lengthBits}]</em></p>
        <hr>
        <p><strong>Timing Pattern Correct:</strong> ${timingCorrect ? 'Yes' : 'No'}</p>
        <p><strong>Format Info Valid:</strong> ${checkFormatInfoValid() ? 'Yes' : 'No'}</p>
        <p><strong>Version Info Correct:</strong> ${checkVersionInfoCorrect() ? 'Yes' : 'No'}</p>
        <p><strong>Dark Module Percentage:</strong> ${darkModulePercentage.toFixed(2)}% (${darkModuleCount})</p>
    `;
    // 6. Show the extracted bits in the textarea
    els.data.value =
`--- EDIT THE 'All Bits' LINE BELOW ---
(Changes update the grid's data area)
(Max ${maxDataBits} bits for this configuration)

All Bits (in read order):
${bits}

--- Parsed Data (Read Only) ---
Mode Bits (first 4): ${modeBits} => ${modeString}
Length Bits (next 8, *approx*): ${lengthBits} => ${lengthDecimal}

Payload Bits:
${dataBits}

ASCII Interpretation (best effort):
${ascii}

Hex Interpretation (best effort):
${hex}`;
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
            { dx: -1, dy: 0 }  // Left
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

els.data.addEventListener('input', () => {
    const content = els.data.value;
    const lines = content.split('\n');
    let bitsLineIndex = -1;
    for(let i = 0; i < lines.length; i++) {
        if (lines[i].startsWith('All Bits (in read order):')) {
            bitsLineIndex = i + 1; // The bits are expected on the next line
            break;
        }
    }

    if (bitsLineIndex !== -1 && bitsLineIndex < lines.length) {
        const bitsString = lines[bitsLineIndex].trim().replace(/\s/g, ''); // Remove spaces

        // Validate: only 0s and 1s
        if (!/^[01]*$/.test(bitsString)) {
            showNotification('Invalid characters in "All Bits". Only 0 and 1 allowed.');
            // Optional: revert textarea? For now, just notify.
            return;
        }

        const maxDataBits = countAvailableDataCells();
        if (bitsString.length > maxDataBits) {
            showNotification(`Error: Input exceeds max data bits (${maxDataBits}). Truncating is not automatic.`);
            // Optional: Truncate bitsString = bitsString.substring(0, maxDataBits);
            // For now, we prevent the update if too long.
             return;
        }

        // If valid and within limits, update the grid
        writeBitsToGrid(bitsString);
        drawGrid(); // Redraw the grid with the new bits
        interpretData(); // Re-interpret the *new* grid state and update info/textarea sections

    } else {
        // Could not find the line - maybe user deleted it?
        showNotification('Could not find "All Bits" line to parse. Structure is incorrect.');
    }
});

els.genBtn.addEventListener('click', initGrid);
els.static.addEventListener('change', () => cfg.editStatic = els.static.checked);
els.formatInfo.addEventListener('input', () => {
    patterns.format();
    updateFormatInfoDisplay();
    drawGrid();
    interpretData(); // Re-interpret after format change
});
els.versionInfo.addEventListener('input', () => {
    patterns.version();
    drawGrid();
    interpretData(); // Re-interpret after version info change
});
els.errCorr.addEventListener('change', () => {
    // Changing ECC/Mask requires re-calculating Format Info
    updateFormatInfo();
    // Format info change might change reserved bits, so re-interpret
    interpretData();
});
els.maskPattern.addEventListener('change', () => {
    // Changing ECC/Mask requires re-calculating Format Info
    updateFormatInfo();
    // Format info change might change reserved bits, so re-interpret
    interpretData();
});
els.readOrderBtn.addEventListener('click', () => {
    cfg.showReadOrder = !cfg.showReadOrder;
    els.readOrderBtn.textContent = cfg.showReadOrder ? 'Hide Read Order' : 'Show Read Order';
    drawGrid(); // Just redraw, no data change
});
els.dimensionsBtn.addEventListener('click', () => {
    cfg.showDimensions = !cfg.showDimensions;
    els.dimensionsBtn.textContent = cfg.showDimensions ? 'Hide Dimensions' : 'Show Dimensions';
    drawGrid(); // Just redraw, no data change
});

initGrid();
