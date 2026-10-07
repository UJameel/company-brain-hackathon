"""Pantheon: a Company Brain run by named agents, each mapped to a region of the human brain.

Hermes      thalamus            routes requests and picks the model per step
Cerberus    amygdala            authorization gate: Scalekit identity == Cognee user
Mnemosyne   hippocampus         ingests via Scalekit as each user, remembers into Cognee
Athena      prefrontal cortex   recalls, reasons, answers with provenance
Hephaestus  motor cortex        acts in tools as the user, via Scalekit
Themis      orbitofrontal       evaluates: independent scorer, before/after
Morpheus    sleep               consolidates: improve(), session memory
"""
