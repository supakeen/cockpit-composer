import React, { useState } from "react";
import PropTypes from "prop-types";
import { useDispatch, useSelector } from "react-redux";
import { Button } from "@patternfly/react-core";
import { FormattedMessage, defineMessages, useIntl } from "react-intl";
import componentTypes from "@data-driven-forms/react-form-renderer/component-types";
import {
  imageOutput,
  awsAuth,
  awsDest,
  azureAuth,
  azureDest,
  vmwareAuth,
  vmwareDest,
  ociAuth,
  ociDest,
  ostreeSettings,
  fdo,
  system,
  packages,
  review,
  users,
} from "./steps";
import MemoizedImageCreator from "./ImageCreator";
import { hostnameValidator, ostreeValidator } from "./validators";
import "./CreateImageWizard.css";
import { selectAllImageTypes, createImage } from "../../slices/imagesSlice";
import { updateBlueprint } from "../../slices/blueprintsSlice";

const messages = defineMessages({
  createImage: {
    id: "wizard.createImage",
    defaultMessage: "Create image",
  },
});

const CreateImageWizard = (props) => {
  const intl = useIntl();
  const dispatch = useDispatch();

  const getImageTypes = () =>
    useSelector((state) => selectAllImageTypes(state));
  const imageTypes = getImageTypes();

  const [isWizardOpen, setIsWizardOpen] = useState(false);

  const handleClose = () => {
    setIsWizardOpen(false);
  };

  const handleOpen = () => {
    setIsWizardOpen(true);
  };

  const handleSaveBlueprint = (formProps) => {
    const { formValues, setIsSaving, setHasSaved } = formProps;
    setIsSaving(true);
    const blueprintData = stateToBlueprint(formValues);
    dispatch(updateBlueprint(blueprintData));
    setIsSaving(false);
    setHasSaved(true);
  };

  const handleBuildImage = async (formProps) => {
    const { formValues } = formProps;

    let uploadSettings;
    if (formValues["image-upload"]) {
      if (formValues["image-output-type"] === "ami") {
        uploadSettings = {
          image_name: formValues["aws-image-name"],
          provider: "aws",
          settings: {
            accessKeyID: formValues["aws-access-key"],
            secretAccessKey: formValues["aws-secret-access-key"],
            bucket: formValues["aws-s3-bucket"],
            region: formValues["aws-region"],
          },
        };
      } else if (formValues["image-output-type"] === "vhd") {
        uploadSettings = {
          image_name: formValues["azure-image-name"],
          provider: "azure",
          settings: {
            storageAccount: formValues["azure-storage-account"],
            storageAccessKey: formValues["azure-storage-access-key"],
            container: formValues["azure-storage-container"],
          },
        };
      } else if (formValues["image-output-type"] === "vmdk") {
        uploadSettings = {
          image_name: formValues["vmware-image-name"],
          provider: "vmware",
          settings: {
            username: formValues["vmware-username"],
            password: formValues["vmware-password"],
            host: formValues["vmware-host"],
            cluster: formValues["vmware-cluster"],
            dataCenter: formValues["vmware-data-center"],
            dataStore: formValues["vmware-data-store"],
          },
        };
      } else if (formValues["image-output-type"] === "oci") {
        uploadSettings = {
          image_name: formValues["oci-image-name"],
          provider: "oci",
          settings: {
            user: formValues["oci-user-ocid"],
            privateKey: formValues["oci-private-key"],
            fingerprint: formValues["oci-fingerprint"],
            filename: formValues["oci-private-key-filename"],
            bucket: formValues["oci-bucket"],
            namespace: formValues["oci-bucket-namespace"],
            region: formValues["oci-bucket-region"],
            compartment: formValues["oci-bucket-compartment"],
            tenancy: formValues["oci-bucket-tenancy"],
          },
        };
      }
    }

    let ostreeSettings;
    const ostreeImageTypes = [
      "iot-commit",
      "edge-commit",
      "edge-container",
      "edge-installer",
      "edge-raw-image",
      "edge-simplified-installer",
    ];
    if (ostreeImageTypes.includes(formValues["image-output-type"])) {
      ostreeSettings = {
        parent: formValues["ostree-parent-commit"],
        ref: formValues["ostree-ref"],
        url: formValues["ostree-repo-url"],
      };
    }

    const blueprintArgs = {
      blueprintName: formValues["blueprint-name"],
      type: formValues["image-output-type"],
      size: formValues["image-size"],
      ostree: ostreeSettings,
      upload: uploadSettings,
    };

    dispatch(createImage(blueprintArgs));
    setIsWizardOpen(false);
  };

  const handleSubmit = (action, formProps) => {
    if (action === "build") {
      handleBuildImage(formProps);
    } else if (action === "save") {
      handleSaveBlueprint(formProps);
    }
  };

  const blueprintToState = (blueprint) => {
    const formState = {};
    formState["blueprint-name"] = blueprint.name;
    formState["blueprint-description"] = blueprint.description;
    formState["blueprint-groups"] = blueprint.groups;
    if (blueprint.customizations) {
      formState["customizations-hostname"] = blueprint.customizations.hostname;
      formState["customizations-install-device"] =
        blueprint.customizations.installation_device;
      formState["customizations-users"] = [];
      if (blueprint.customizations.user?.length) {
        blueprint.customizations.user.forEach((user) => {
          const formUser = {
            username: user.name,
            password: user.password,
            "is-admin": user.groups?.includes("wheel"),
            "ssh-key": user.key,
          };
          formState["customizations-users"].push(formUser);
        });
      }
    }
    formState["selected-packages"] = blueprint.packages.map((pkg) => pkg.name);

    return formState;
  };

  const stateToBlueprint = (formValues) => {
    const formattedPacks = formValues?.["selected-packages"]?.map((pkg) => ({
      name: pkg,
      version: "*",
    }));
    const customizations = {};
    customizations.hostname = formValues?.["customizations-hostname"];
    customizations.installation_device =
      formValues?.["customizations-install-device"];
    customizations.user = [];
    if (formValues["customizations-users"]?.length) {
      formValues["customizations-users"].forEach((formUser) => {
        const bpUser = {
          name: formUser.username,
          password: formUser.password,
          groups: formUser["is-admin"] ? ["wheel"] : [],
          key: formUser["ssh-key"],
        };
        customizations.user.push(bpUser);
      });
    }
    if (formValues["image-output-type"] === "edge-simplified-installer") {
      customizations.fdo = {
        manufacturing_server_url:
          formValues["customizations-manufacturing-server-url"],
        diun_pub_key_insecure:
          formValues["customizations-diun-pub-key-insecure"],
        diun_pub_key_hash: formValues["customizations-diun-pub-key-hash"],
        diun_pub_key_root_certs:
          formValues["customizations-diun-pub-key-root-certs"],
      };
    }

    const blueprintData = {
      name: formValues?.["blueprint-name"],
      description: formValues?.["blueprint-description"],
      modules: [],
      packages: formattedPacks,
      groups: formValues?.["blueprint-groups"],
      customizations,
    };

    return blueprintData;
  };

  return (
    <>
      <Button
        variant="secondary"
        onClick={handleOpen}
        isDisabled={!props.blueprint?.name || !imageTypes?.length}
        aria-label={intl.formatMessage(messages.createImage)}
      >
        <FormattedMessage defaultMessage="Create image" />
      </Button>
      {isWizardOpen && (
        <MemoizedImageCreator
          onClose={handleClose}
          onSubmit={(action, formValues) => handleSubmit(action, formValues)}
          customValidatorMapper={{ hostnameValidator, ostreeValidator }}
          schema={{
            fields: [
              {
                component: componentTypes.WIZARD,
                name: "create-image-wizard",
                id: "create-image-wizard",
                isDynamic: true,
                inModal: true,
                showTitles: true,
                title: intl.formatMessage(messages.createImage),
                buttonLabels: {
                  submit: intl.formatMessage(messages.createImage),
                },
                fields: [
                  imageOutput(intl),
                  awsAuth(intl),
                  awsDest(intl),
                  azureAuth(intl),
                  azureDest(intl),
                  ociAuth(intl),
                  ociDest(intl),
                  vmwareAuth(intl),
                  vmwareDest(intl),
                  ostreeSettings(intl),
                  fdo(intl),
                  system(intl),
                  users(intl),
                  packages(intl),
                  review(intl),
                ],
                crossroads: ["image-output-type", "image-upload"],
              },
            ],
          }}
          initialValues={blueprintToState(props.blueprint)}
          blueprint={props.blueprint}
          imageTypes={imageTypes}
        />
      )}
    </>
  );
};

CreateImageWizard.propTypes = {
  blueprint: PropTypes.object,
};

export default CreateImageWizard;