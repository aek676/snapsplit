# ---------------------------------------------------------------------------
# VM scaffold delivery via OCI CLI Run Command (Oracle Cloud Agent)
# ---------------------------------------------------------------------------
#
# The OCI provider does not expose InstanceAgentCommand as a managed resource,
# so we drive the existing Oracle Cloud Agent "Instance Run Command" plugin from
# the `oci` CLI. A `null_resource` runs on the machine applying this config and
# calls `oci instance-agent command create`, whose target is `var.instance_ocid`
# (the VM my-oci-iac owns). The agent pulls every PAR into /opt/apps/snapsplit.
#
# Re-push on change: `triggers.deploy_hash` rotates whenever a deploy file
# changes, so a new command is created and the VM gets the new scaffold.
#
# Requirements on the runner:
#   - `oci` CLI on PATH, authenticated to manage instance-agent-command-family here.
#   - the VM's Oracle Cloud Agent must have the "Instance Run Command" plugin
#     enabled (default on Oracle Linux 9 platform images), and the plugin's user
#     (`ocarun`) must be able to write /opt/apps — e.g. grant it NOPASSWD sudo
#     once on the VM (`ocarun ALL=(ALL) NOPASSWD:ALL`), since the script uses sudo.

resource "null_resource" "vm_scaffold" {
  count = var.instance_ocid != "" ? 1 : 0

  triggers = {
    deploy_hash = local.deploy_hash
  }

  provisioner "local-exec" {
    interpreter = ["/bin/bash", "-c"]
    command     = <<-EOT
      set -euo pipefail

      # The `oci` CLI must be on PATH (the deploying identity's machine). HCP
      # Terraform remote runners do not have it, so skip cleanly there and let
      # the rest of the infra apply; deliver the scaffold locally or via the
      # `deploy_pull_commands` output instead.
      if ! command -v oci >/dev/null 2>&1; then
        echo "oci CLI not found on this runner; skipping VM scaffold delivery."
        echo "Run 'terraform apply' from a machine with the oci CLI, or use the"
        echo "'deploy_pull_commands' output to copy the files onto the VM by hand."
        exit 0
      fi

      # Build the command content JSON (the script that runs on the VM) safely,
      # letting Python handle escaping instead of fighting bash quoting.
      python3 - <<'PY' > /tmp/snapsplit_cmd_content.json
      import json
      script = '''${local.deploy_script}'''
      print(json.dumps({
          "source": {"sourceType": "TEXT", "text": script},
          "output": {"outputType": "TEXT"},
      }))
      PY

      CMD_ID=$(oci instance-agent command create \
        --compartment-id '${var.compartment_ocid}' \
        --display-name 'snapsplit-deploy-${local.deploy_hash}' \
        --timeout-in-seconds 300 \
        --target '{"instanceId":"${var.instance_ocid}"}' \
        --content file:///tmp/snapsplit_cmd_content.json \
        --query 'data.id' --raw-output)

      echo "Created Oracle Cloud Agent command $${CMD_ID} targeting ${var.instance_ocid}"
      rm -f /tmp/snapsplit_cmd_content.json
    EOT
  }
}
