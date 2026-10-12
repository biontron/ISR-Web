
/*
# Infrastructure Repository (ISR) / Infrastruktur Repository (ISR)
# SPDX-License-Identifier: GPL-2.0 #  
*/

const fs = require("fs");
const path = require("path");

// Pfad zur index.html Datei
const filePath = path.join(__dirname, "../build", "index.html");

// Lese die Datei
fs.readFile(filePath, "utf8", (err, data) => {
	if (err) {
		console.error("postbuild: Error at reading from file:", err);
		return console.log(err);
	}

	// Der HTML-Minifier schreibt <!doctype html> und && in Inline-Skripten.
	// Beides ist kein wohlgeformtes XML. CDATA lässt && im Skript stehen und bleibt in HTML ein Kommentar.
    const corrected = data
        .replace(/<!doctype\s+html\s*>/gi, "<!DOCTYPE html>")
        .replace(/<script(\s[^>]*)?>([\s\S]*?)<\/script>/gi, (match, attrs, body) => {
			if (!body || body.includes("<![CDATA[") || !/[&<]/.test(body)) {
				return match;
			}
			return `<script${attrs || ""}>/*<![CDATA[*/${body}/*]]>*/</script>`;
		})
        .replace(/<meta(?!.*\/>)([^>]*)>/gi, "<meta$1/>")
        .replace(/<img(?!.*\/>)([^>]*)>/gi, "<img$1/>")
        .replace(/<link(?!.*\/>)([^>]*)>/gi, "<link$1/>")
        .replace(/<input(?!.*\/>)([^>]*)>/gi, "<input$1/>")
        .replace(/<br(?!.*\/>)([^>]*)>/gi, "<br$1/>")
        .replace(/<hr(?!.*\/>)([^>]*)>/gi, "<hr$1/>");

	// Schreibe die modifizierte Datei zurück
	fs.writeFile(filePath, corrected, "utf8", (err) => {
        if (err) {
            console.error("postbuild: Error at writing to file:", err);
            return;
        }
		console.log("postbuild: Updated index.html to be valid XHTML/XML.");
	});
});