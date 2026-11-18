#!/usr/bin/env bash
set -euo pipefail

# Usage: bash scripts/test_ollama_direct.sh [server] [model]
SERVER="${1:-http://localhost:11434}"
MODEL="${2:-llama3}"
QUESTION="Despite the diversity among GPCRs, are there similarities in their activation pathways?"
IFS= read -r -d '' SYSTEM <<'EOF' || [[ -n "$SYSTEM" ]]
Use the following information to answer the question in less than 200 words, try not to use anything else: [tipsychotics). GPCR activation is facilitated by extracellular ligands, and leads to the recruitment of intracellular G proteins 3,6. Structural rearrangements of residue contacts in the transmembrane domain serve as ‘activation pathways’ that connect the ligand- binding pocket to the G protein-coupling region within the receptor. How similar are these activation pathways across different class A GPCRs? Here, we analysed 27 GPCRs from diverse subgroups for which structures of active and/or inactive states are available. We show that despite the diversity in activation pathways between receptors, the pathways converge near the G protein- coupling region. This convergence is mediated by a strikingly conserved structural rearrangement of, eptor activation are broadly similar (e.g. contraction of ligand binding site, opening of the cytosolic side due to relocation of TM6). However, receptor activation is mediated by diverse ligands and hence some aspects of ligand-induced GPCR activation must necessarily be receptor-specific. How similar are the activation pathways across different receptors? We carried out a comprehensive comparison of residue contacts of inactive and active state structures. Structural equivalence for residues across the different GPCRs was assigned using the GPCRdb numbering scheme 19 from GPCRdb 20 (www.gpcrdb.org ) (Methods). A contact between a pair of residues is defined to exist if the inter-atomic distance between any two atoms across the res, t reconsideration of the mechanisms involved in cellular signaling diversiﬁcation. Despite their large numbers, GPCRs can only signal through the same limited number of Gproteins that they can activate. Previous studies indicated that signaling diversity is in part dictated by a combination of G pro- teins activated by individual GPCRs ( Inoue et al., 2019 ;Masuho (C) G a-selectivity ﬁngerprints of RGS13 WT (left), RGS18 WT (right), and the chimera (center). (D) G a-selectivity bar codes of RGS8 WT, RGS14 WT, and the RGS8/14-F chimera. (E) Ga-selectivity ﬁngerprints of RGS8 WT (left), RGS14 WT (right), and the RGS8/14-F chimera. Plotted values are means ±SEMs of 3 independent experiments. The PDB accession number 1AGR is used in (B) and (D), Diverse activation pathways in class A GPCRs converge near the G protein-coupling region A. J. Venkatakrishnan1,6,*, Xavier Deupi2, Guillaume Lebon3, Franziska M. Heydenreich2,4, Tilman Flock1, Tamara Miljus2,4, Santhanam Balaji1, Michel Bouvier5, Dmitry B. Veprintsev2,4, Christopher G. Tate1, Gebhard F. X. Schertler2,4, and M. Madan Babu1,* 1MRC Laboratory of Molecular Biology, Francis Crick Avenue, Cambridge CB2 0QH, United Kingdom 2Paul Scherrer Institute, Villigen, Switzerland 3Institut de Génomique Fonctionnelle, CNRS UMR 5203, INSERM U1191, Université Montpellier, Montpellier, France 4Department of Biology, ETH Zurich, Wolfgang-Pauli-Str. 27, Zurich, Switzerland 5Institute for Research in Immunology and Cancer, University of Mo, uscarinic receptor (M2R) 11, nucleoside-activatable A 2A receptor (A 2AR)12, and peptide-activatable µ-opioid receptor (µOR) 10. The remaining structures have been determined only in either inactive or active states. The availability of structures of GPCRs from divergent subgroups (as low as ~20% sequence identity 18) that are bound to chemically diverse ligands and known to couple to different G proteins, allowed us to investigate activation pathways across class A GPCRs. Given that the GPCRs are structurally similar and activate a small set of G proteins, some structural aspects of receptor activation are broadly similar (e.g. contraction of ligand binding site, opening of the cytosolic side due to relocation of TM6). However, rece, ic residue contacts that mediate the convergence of activation pathways across class A GPCRs. Because the microenvironment (i.e. surrounding residues/second shell residues) in which such rearrangement takes place diverges between receptor families, the detailed mechanism by which this common step is facilitated by diverse ligands is likely to be distinct for different sets of GPCRs. Remarkably, despite such differences, we find that the activation pathways ultimately converge to a common and very specific set of contact rearrangements between topologically equivalent residues near the G protein-coupling region. Future studies aimed at investigating residues at and around these positions can help uncover the unique steps that lead to]
EOF
SYSTEM="${SYSTEM%$'\n'}"

for tool in curl jq; do
    if ! command -v "$tool" >/dev/null 2>&1; then
        printf 'Required tool not found: %s\n' "$tool" >&2
        exit 1
    fi
done

payload=$(jq -n --arg model "$MODEL" --arg prompt "$QUESTION" --arg system "$SYSTEM" \
    '{model: $model, stream: false, prompt: $prompt, system: $system}')
response=$(mktemp)
trap 'rm -f "$response"' EXIT

printf 'Server: %s\nModel: %s\nQuestion: %s\n\n' "$SERVER" "$MODEL" "$QUESTION"
curl --silent --show-error --fail-with-body \
    --connect-timeout 10 --max-time 180 \
    --header 'Content-Type: application/json' \
    --output "$response" --write-out 'Total: %{time_total}s\n' \
    --data "$payload" "${SERVER%/}/api/generate" || {
    cat "$response" >&2
    printf '\nOllama request failed.\n' >&2
    exit 1
}

if ! jq -e 'type == "object" and .error == null and .done == true and
    (.response | type == "string" and length > 0)' "$response" >/dev/null; then
    printf 'Ollama did not return a completed, nonempty answer:\n' >&2
    cat "$response" >&2
    exit 1
fi

printf '\nAnswer:\n'
jq -r '.response' "$response"
