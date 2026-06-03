This project is built by the community, for the community. We believe in the power of open-source software and free collaboration. A massive thank you to our contributors:

* 👤 **Claudio Bodai** - *Creator & Lead Maintainer* - [@claudiobodai](https://github.com/claudiobodai)
* 👤 **Open Source Community** - *Various bug fixes, testing, and template improvements*

### Contributing
We welcome contributions! If you have suggestions, bug reports, or want to add a new feature to support newer Umbraco versions, please feel free to open an issue or submit a Pull Request.

## 📄 License

This project is licensed under the **MIT License**. This means you are completely free to use, modify, and distribute this software in your own projects, whether open-sourceHere is the revised and updated version of the `README.md`. I have tailored the goal and explanation to specifically highlight the generation of **Web Components for Umbraco 17**, adjusted what `createPlugin.js` actually does, and completely removed the unnecessary `npm link` section. I also updated the contributors section to be more realistic.

# PackageFurnace 🏭

![Version](https://img.shields.io/badge/version-1.0.0-blue.svg)
![License](https://img.shields.io/badge/license-MIT-green.svg)
![Node.js](https://img.shields.io/badge/node-%3E%3D%2014.0.0-brightgreen.svg)
![Build Status](https://img.shields.io/badge/build-passing-brightgreen.svg)
![PRs Welcome](https://img.shields.io/badge/PRs-welcome-brightgreen.svg)

## 🎯 Goal

**PackageFurnace** is a lightweight, efficient command-line utility and boilerplate generator designed to streamline the creation of Web Components. 

The primary goal of this project is to eliminate the repetitive tasks associated with setting up new architectures. **This tool is especially built for developers who want to create, use, and integrate new Web Components within Umbraco 17.** By utilizing the core `createPlugin.js` script, developers can instantly scaffold robust, standardized, and production-ready structures tailored for the Umbraco backoffice, allowing them to focus entirely on writing their core business logic rather than configuring boilerplate code and folder hierarchies.

## 📖 Explanation

When managing a modular application architecture like Umbraco 17, consistency across custom elements is key. PackageFurnace acts as your central "forge" for producing these Web Components. 

The repository includes:
* **`createPlugin.js`**: The core execution script that handles the scaffolding process. It sets up the necessary files, default web component entry points, and configurations required to run seamlessly within Umbraco 17.
* **`.gitignore`**: Pre-configured rules to ensure no unnecessary modules or build artifacts are pushed to your version control.

The tool works by bootstrapping a highly optimized, Umbraco-ready template directly into your working directory, ensuring your new Web Components follow the latest standards.

## 🚀 Getting Started

Follow these instructions to get a copy of the project up and running on your local machine for development purposes.

### Prerequisites

You need to have Node.js and a package manager installed:
* **Node.js**: v14.0.0 or higher
* **npm**: v6.0.0 or higher (or Yarn equivalent)

### 💻 Commands

Here are the essential commands to install and use PackageFurnace:

**1. Clone the repository:**
```bash
git clone https://github.com/claudiobodai/packageFurnace.git
cd packageFurnace
